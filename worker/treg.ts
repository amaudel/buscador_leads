import { ErrorApi } from './errores';
import type { Env } from './index';

/**
 * Conector de Treg para un operador único. No es un proxy de endpoints arbitrarios.
 * Sin TREG_ENABLED, TREG_TOKEN y TREG_ACCESS_KEY no permite llamadas de pago.
 * Complementar con Cloudflare Access antes de publicarlo.
 */
const BASE = 'https://treg.to';
const TOPE_USD = '0.15'; // máximo por petición, NO un presupuesto acumulado.
const CARGOS = ['owner', 'founder', 'CEO', 'director', 'gerente general', 'administrador'] as const;
type Cargo = (typeof CARGOS)[number];

export function tregEstado(_req: Request, env: Env) {
  return { habilitado: env.TREG_ENABLED === 'true' && Boolean(env.TREG_TOKEN && env.TREG_ACCESS_KEY), topePorLlamadaUsd: Number(TOPE_USD) };
}

function exigirAcceso(req: Request, env: Env): string {
  if (env.TREG_ENABLED !== 'true' || !env.TREG_TOKEN || !env.TREG_ACCESS_KEY) {
    throw new ErrorApi('Treg', 503, 'El enriquecimiento está desactivado. Configure los secretos y proteja el Worker con Cloudflare Access.');
  }
  const clave = req.headers.get('x-leads-admin-key');
  if (!clave || clave !== env.TREG_ACCESS_KEY) {
    throw new ErrorApi('Treg', 403, 'Clave de acceso al enriquecimiento incorrecta.');
  }
  return env.TREG_TOKEN;
}

function dominioValido(v: unknown): string {
  if (typeof v !== 'string') throw new ErrorApi('Treg', 400, 'Indique el dominio empresarial.');
  const dominio = v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, '');
  if (dominio.length > 253 || !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(dominio)) {
    throw new ErrorApi('Treg', 400, 'Dominio empresarial no válido.');
  }
  if (/(^|\.)(facebook|instagram|tiktok|linkedin|google|linktr|wa)\./.test(dominio)) {
    throw new ErrorApi('Treg', 400, 'Se requiere el dominio propio de la empresa, no una red social.');
  }
  return dominio;
}

async function cuerpo(req: Request): Promise<Record<string, unknown>> {
  try {
    return registro(await req.json());
  } catch {
    throw new ErrorApi('Treg', 400, 'El cuerpo de la petición no es JSON válido.');
  }
}

function registro(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
}
const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const primerTexto = (x: Record<string, unknown>, campos: string[]) =>
  campos.map((c) => str(x[c])).find(Boolean) ?? '';

export interface PersonaEncontrada {
  nombre: string;
  cargo: string;
  linkedin: string | null;
  email: string | null;
  verificacion: 'valid' | 'invalid' | 'accept_all' | 'unknown';
}
function veredicto(v: unknown): PersonaEncontrada['verificacion'] {
  const s = str(v).toLowerCase();
  if (['valid', 'verified', 'deliverable'].includes(s)) return 'valid';
  if (['invalid', 'undeliverable'].includes(s)) return 'invalid';
  if (['accept_all', 'catch_all', 'risky'].includes(s)) return 'accept_all';
  return 'unknown';
}
function correoSeguro(v: unknown): string | null {
  const email = str(v).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}
function extraerFilas(payload: unknown): Record<string, unknown>[] {
  const data = registro(payload);
  const output = registro(data.output);
  const raw = registro(data.raw);
  const candidatos: unknown[] = [
    data.people, output.people, raw.people, data.results, output.results,
    data.data, output.data, data.output, data,
  ];
  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) return candidato.slice(0, 5).map(registro);
    const obj = registro(candidato);
    if (Array.isArray(obj.people)) return obj.people.slice(0, 5).map(registro);
    if (Array.isArray(obj.results)) return obj.results.slice(0, 5).map(registro);
  }
  return [output, data].filter((x) => Object.keys(x).length > 0).slice(0, 1);
}
export function extraerPersonas(payload: unknown): PersonaEncontrada[] {
  return extraerFilas(payload).map((fila) => {
    const persona = { ...registro(fila.person), ...fila };
    const nombre = primerTexto(persona, ['full_name', 'fullName', 'name', 'nombre']) ||
      [str(persona.first_name), str(persona.last_name)].filter(Boolean).join(' ');
    const verif = registro(persona.verification);
    return {
      nombre,
      cargo: primerTexto(persona, ['title', 'job_title', 'position', 'cargo']),
      linkedin: primerTexto(persona, ['linkedin_url', 'linkedin', 'profile_url']) || null,
      email: correoSeguro(persona.work_email ?? persona.email),
      verificacion: veredicto(verif.verdict ?? verif.status ?? persona.email_status),
    };
  }).filter((p) => p.nombre || p.email);
}

async function consultarTreg(token: string, endpoint: 'treg.people.search' | 'treg.people.email.find', body: Record<string, unknown>, accion: string) {
  const res = await fetch(`${BASE}/call/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-treg-token': token,
      'x-treg-meta': `feature=${accion},workspace=radar-clientes`,
      'x-treg-route-max-cost': TOPE_USD,
      ...(endpoint === 'treg.people.email.find' ? { 'x-treg-route-verify': 'true' } : {}),
    },
    body: JSON.stringify(body),
  });
  // No exponer respuestas de cuenta, saldos ni URLs de recarga de Treg.
  if (res.status === 202) throw new ErrorApi('Treg', 202, 'La consulta sigue pendiente en el proveedor; revise el historial de Treg antes de repetir para evitar cargos.');
  if (!res.ok) throw new ErrorApi('Treg', res.status, res.status === 402 ? 'El proveedor rechaza el presupuesto por llamada o no hay saldo.' : 'Treg o el proveedor rechazó la consulta. Revise Treg y los parámetros.');
  const payload: unknown = await res.json();
  const costo = Number(res.headers.get('x-treg-cost-micro') ?? '0');
  const control = registro(registro(payload)._treg);
  return {
    payload,
    auditoria: {
      callId: res.headers.get('x-treg-call-id') || null,
      proveedor: res.headers.get('x-treg-served-by') || str(control.served_by) || endpoint,
      costoUsd: Number.isFinite(costo) && costo >= 0 ? costo / 1_000_000 : 0,
      topePorLlamadaUsd: Number(TOPE_USD),
      fecha: new Date().toISOString(),
    },
  };
}

export async function tregPersonas(req: Request, env: Env) {
  const token = exigirAcceso(req, env);
  const b = await cuerpo(req);
  const domain = dominioValido(b.domain);
  const cargo = str(b.cargo) as Cargo;
  if (!CARGOS.includes(cargo)) throw new ErrorApi('Treg', 400, 'Seleccione un cargo permitido.');
  // people.search usa company_domain (people.email.find usa domain). limit es el «dial de precio».
  const r = await consultarTreg(token, 'treg.people.search', { company_domain: domain, title: cargo, limit: 5 }, 'personas');
  return { personas: extraerPersonas(r.payload).map((p) => ({ ...p, email: null, verificacion: 'unknown' as const })), ...r.auditoria };
}

export async function tregCorreo(req: Request, env: Env) {
  const token = exigirAcceso(req, env);
  const b = await cuerpo(req);
  const domain = dominioValido(b.domain);
  const fullName = str(b.fullName);
  if (fullName.length < 5 || fullName.length > 120 || !fullName.includes(' ')) throw new ErrorApi('Treg', 400, 'Introduzca nombre y apellido del contacto.');
  const r = await consultarTreg(token, 'treg.people.email.find', { full_name: fullName, domain }, 'correo');
  const p = extraerPersonas(r.payload)[0];
  const metadata = registro(registro(r.payload)._treg);
  const verification = registro(metadata.verification);
  return {
    contacto: {
      nombre: fullName,
      cargo: str(b.cargo).slice(0, 100),
      email: p?.email ?? null,
      verificacion: veredicto(verification.verdict ?? p?.verificacion),
      proveedor: r.auditoria.proveedor,
      fecha: r.auditoria.fecha,
      callId: r.auditoria.callId,
      costoUsd: r.auditoria.costoUsd,
    },
    ...r.auditoria,
  };
}
