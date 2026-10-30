import { consultaFts, terminos, type CandidatoSri } from '../shared/sri';
import { ErrorApi } from './errores';
import type { Env } from './index';

interface FilaSri {
  ruc: string;
  nombre_comercial: string;
  razon_social: string;
  tipo: string;
  canton: string;
  parroquia: string;
  actividad: string;
}

const SQL = `SELECT ruc, nombre_comercial, razon_social, tipo, canton, parroquia, actividad
  FROM sri WHERE sri MATCH ?1 AND (?2 IS NULL OR canton = ?2)
  ORDER BY bm25(sri, 2.0, 1.0) LIMIT 5`;

function aCandidato(f: FilaSri): CandidatoSri {
  return {
    ruc: f.ruc,
    nombreComercial: f.nombre_comercial,
    razonSocial: f.razon_social,
    tipo: f.tipo,
    canton: f.canton,
    parroquia: f.parroquia,
    actividad: f.actividad,
    duenoProbable: f.tipo === 'PERSONA NATURAL' ? f.razon_social : null,
  };
}

/** Busca en el catastro RUC del SRI (Azuay) por nombre comercial o razón social. Gratis. */
export async function buscarSri(req: Request, env: Env) {
  if (!env.SRI_DB) throw new ErrorApi('SRI', 503, 'Los datos del SRI no están cargados en este servidor.');
  let b: { nombre?: unknown; canton?: unknown };
  try {
    b = (await req.json()) as typeof b;
  } catch {
    throw new ErrorApi('SRI', 400, 'El cuerpo de la petición no es JSON válido.');
  }
  const nombre = typeof b.nombre === 'string' ? b.nombre.slice(0, 200) : '';
  const canton = typeof b.canton === 'string' && b.canton.trim() ? b.canton.trim().toUpperCase().slice(0, 60) : null;
  const ts = terminos(nombre);
  if (!ts.length) throw new ErrorApi('SRI', 400, 'Indica el nombre del negocio.');

  const consultar = async (q: string | null, c: string | null) =>
    q ? ((await env.SRI_DB!.prepare(SQL).bind(q, c).all<FilaSri>()).results ?? []) : [];

  // De más estricto a más flexible: todos los términos en el cantón → en Azuay → alguno en el cantón.
  let filas = await consultar(consultaFts(ts, 'todos'), canton);
  if (!filas.length && canton) filas = await consultar(consultaFts(ts, 'todos'), null);
  if (!filas.length && ts.length > 1) filas = await consultar(consultaFts(ts, 'alguno'), canton);
  return { candidatos: filas.map(aCandidato), terminos: ts, fuente: 'SRI · catastro RUC Azuay (datos abiertos)' };
}
