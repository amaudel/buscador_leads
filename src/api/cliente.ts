import type {
  AnalisisGemini, Borradores, ErrorApi, MetricaNicho, NegocioPlaces, PerfilVendedor, RankingNichos,
  RespuestaPlaces, ResultadoPageSpeed, TipoWeb,
} from '../../shared/tipos';
import { useAjustes } from '../datos/ajustes';

export class FalloApi extends Error {
  constructor(public origen: string, public estado: number, mensaje: string) {
    super(mensaje);
  }
  get completo() {
    return `${this.origen} (${this.estado}): ${this.message}`;
  }
}

export const mensajeError = (e: unknown) => (e instanceof FalloApi ? e.completo : e instanceof Error ? e.message : String(e));

async function llamar<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
  const a = useAjustes.getState();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (a.claveGoogle) headers['x-google-key'] = a.claveGoogle;
  if (a.claveGemini) headers['x-gemini-key'] = a.claveGemini;
  if (a.modeloGemini) headers['x-gemini-model'] = a.modeloGemini;
  let res: Response;
  try {
    res = await fetch(ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  } catch (e) {
    throw new FalloApi('Red', 0, `No se pudo conectar con el servidor: ${e instanceof Error ? e.message : e}`);
  }
  const texto = await res.text();
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new FalloApi('Servidor', res.status, texto.slice(0, 300) || res.statusText);
  }
  if (!res.ok) {
    const e = (datos as ErrorApi).error;
    throw new FalloApi(e?.origen ?? 'Servidor', e?.estado ?? res.status, e?.mensaje ?? res.statusText);
  }
  return datos as T;
}

export type GeminiConMeta = AnalisisGemini & { modelo: string; modo: string; avisos: string[] };

export const api = {
  estado: () =>
    llamar<{ gemini: boolean; google: boolean; secretos: { gemini: boolean; google: boolean }; modeloGemini: string | null }>('GET', '/api/estado'),

  probar: (servicio: 'gemini' | 'google') => llamar<{ ok: boolean; detalle: string }>('POST', '/api/probar', { servicio }),

  buscar: (textQuery: string, regionCode: string, pageToken?: string | null) => {
    useAjustes.getState().sumarLlamadaPlaces();
    return llamar<RespuestaPlaces>('POST', '/api/places/search', { textQuery, regionCode, pageToken: pageToken ?? undefined });
  },

  pagespeed: (url: string) => llamar<ResultadoPageSpeed>('POST', '/api/pagespeed', { url }),

  analizarWeb: (negocio: NegocioPlaces, pagespeed: ResultadoPageSpeed | null) =>
    llamar<GeminiConMeta>('POST', '/api/gemini/analizar-web', { negocio, pagespeed }),

  analizarSinWeb: (negocio: NegocioPlaces, tipoWeb: TipoWeb) =>
    llamar<GeminiConMeta>('POST', '/api/gemini/analizar-sin-web', { negocio, tipoWeb }),

  borradores: (b: {
    negocio: NegocioPlaces;
    analisis: Pick<AnalisisGemini, 'resumen' | 'problemas' | 'servicio'> | null;
    sinWebPropia: boolean;
    perfil: PerfilVendedor;
    tono: string;
  }) => llamar<Omit<Borradores, 'negocioId' | 'tono' | 'fecha'> & { modelo: string }>('POST', '/api/gemini/borradores', b),

  nichos: (zona: string, metricas: MetricaNicho[], perfil: PerfilVendedor) =>
    llamar<RankingNichos & { modelo: string }>('POST', '/api/gemini/nichos', { zona, metricas, perfil }),
};

/** El secreto administrativo solo se conserva en la memoria del formulario, nunca en localStorage. */
export interface PersonaTreg {
  nombre: string;
  cargo: string;
  linkedin: string | null;
  email: string | null;
  verificacion: 'valid' | 'invalid' | 'accept_all' | 'unknown';
}
interface AuditoriaTreg {
  callId: string | null;
  proveedor: string;
  costoUsd: number;
  topePorLlamadaUsd: number;
  fecha: string;
}
async function llamarTreg<T>(ruta: string, clave: string, cuerpo: Record<string, unknown>): Promise<T> {
  const res = await fetch(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-leads-admin-key': clave },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json() as T & { error?: { origen: string; mensaje: string } };
  if (!res.ok) throw new FalloApi(datos.error?.origen ?? 'Treg', res.status, datos.error?.mensaje ?? 'Consulta fallida');
  return datos;
}
export const treg = {
  estado: async () => {
    const res = await fetch('/api/treg/estado');
    if (!res.ok) throw new Error('No se pudo consultar la configuración de Treg');
    return res.json() as Promise<{ habilitado: boolean; topePorLlamadaUsd: number }>;
  },
  personas: (clave: string, domain: string, cargo: string) =>
    llamarTreg<{ personas: PersonaTreg[] } & AuditoriaTreg>('/api/treg/personas', clave, { domain, cargo }),
  correo: (clave: string, domain: string, fullName: string, cargo: string) =>
    llamarTreg<{ contacto: import('../../shared/tipos').ContactoComercial } & AuditoriaTreg>('/api/treg/correo', clave, { domain, fullName, cargo }),
};
