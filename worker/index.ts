import { z } from 'zod';
import { esquemaAnalisisSinWeb, esquemaAnalisisWeb, esquemaBorradores, esquemaNichos } from '../shared/esquemas';
import { PLACES_FIELD_MASK, mapearPlace } from '../shared/places';
import type { MetricaNicho, NegocioPlaces, PerfilVendedor, RespuestaPlaces, ResultadoPageSpeed } from '../shared/tipos';
import { ErrorApi, comprobar } from './errores';
import { generar, generarConUrl, parsearJson, probarClave, resolverModelo } from './gemini';
import * as P from './prompts';

export interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY?: string;
  GOOGLE_CLOUD_API_KEY?: string;
}

const json = (datos: unknown, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// La clave pegada en Ajustes (cabecera) tiene prioridad; el secreto del entorno es el respaldo.
function claveGoogle(req: Request, env: Env): string {
  const k = req.headers.get('x-google-key') || env.GOOGLE_CLOUD_API_KEY;
  if (!k) throw new ErrorApi('Configuración', 400, 'Falta la clave de Google Cloud. Pégala en Ajustes.');
  return k;
}

function claveGemini(req: Request, env: Env): string {
  const k = req.headers.get('x-gemini-key') || env.GEMINI_API_KEY;
  if (!k) throw new ErrorApi('Configuración', 400, 'Falta la clave de Gemini. Pégala en Ajustes.');
  return k;
}

async function leerCuerpo<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ErrorApi('Petición', 400, 'El cuerpo de la petición no es JSON válido.');
  }
}

// ---------- Places ----------
async function buscarPlaces(req: Request, env: Env): Promise<RespuestaPlaces> {
  const b = await leerCuerpo<{ textQuery?: string; regionCode?: string; pageToken?: string }>(req);
  if (!b.textQuery?.trim()) throw new ErrorApi('Petición', 400, 'Falta la consulta de búsqueda.');
  const cuerpo: Record<string, unknown> = {
    textQuery: b.textQuery.trim(),
    languageCode: 'es',
    regionCode: (b.regionCode || 'ES').toUpperCase(),
    pageSize: 20,
  };
  if (b.pageToken) cuerpo.pageToken = b.pageToken;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': claveGoogle(req, env),
      'x-goog-fieldmask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = (await comprobar(res, 'Places')) as { places?: unknown[]; nextPageToken?: string } | null;
  return {
    negocios: (datos?.places ?? []).map(mapearPlace),
    nextPageToken: datos?.nextPageToken ?? null,
  };
}

// ---------- PageSpeed ----------
const AUDITORIAS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
  'is-on-https',
  'viewport',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapearPageSpeed(datos: any): ResultadoPageSpeed {
  const lh = datos?.lighthouseResult ?? {};
  const nota = (id: string) => {
    const s = lh.categories?.[id]?.score;
    return typeof s === 'number' ? Math.round(s * 100) : null;
  };
  const audits = lh.audits ?? {};
  return {
    urlFinal: lh.finalDisplayedUrl ?? lh.finalUrl ?? datos?.id ?? '',
    notas: {
      performance: nota('performance'),
      seo: nota('seo'),
      accessibility: nota('accessibility'),
      bestPractices: nota('best-practices'),
    },
    captura: audits['final-screenshot']?.details?.data ?? null,
    auditorias: AUDITORIAS.filter((id) => audits[id]).map((id) => ({
      id,
      titulo: audits[id].title ?? id,
      valor: audits[id].displayValue ?? null,
      ok: typeof audits[id].score === 'number' ? audits[id].score >= 0.9 : null,
    })),
  };
}

async function pagespeed(req: Request, env: Env): Promise<ResultadoPageSpeed> {
  const { url } = await leerCuerpo<{ url?: string }>(req);
  if (!url || !/^https?:\/\//i.test(url)) throw new ErrorApi('Petición', 400, 'URL no válida para PageSpeed.');
  const q = new URLSearchParams({ url, strategy: 'mobile', locale: 'es', key: claveGoogle(req, env) });
  for (const c of ['performance', 'seo', 'accessibility', 'best-practices']) q.append('category', c);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
  return mapearPageSpeed(await comprobar(res, 'PageSpeed'));
}

// ---------- Gemini ----------
async function modelo(req: Request, env: Env) {
  const clave = claveGemini(req, env);
  return { clave, modelo: await resolverModelo(clave, req.headers.get('x-gemini-model')) };
}

async function analizarWeb(req: Request, env: Env) {
  const { negocio, pagespeed: ps } = await leerCuerpo<{ negocio: NegocioPlaces; pagespeed: ResultadoPageSpeed | null }>(req);
  if (!negocio?.web) throw new ErrorApi('Petición', 400, 'El negocio no tiene web para analizar.');
  const m = await modelo(req, env);
  const r = await generarConUrl({
    ...m,
    esquema: esquemaAnalisisWeb,
    promptUnico: P.promptAnalisisWeb(negocio, ps),
    promptLectura: P.promptLecturaWeb(negocio),
    promptEstructurar: (lectura) => P.promptEstructurarAnalisis(negocio, ps, lectura),
  });
  return { ...r.datos, problemas: r.datos.problemas.slice(0, 5), modelo: r.modelo, modo: r.modo, avisos: r.avisos };
}

async function analizarSinWeb(req: Request, env: Env) {
  const { negocio, tipoWeb } = await leerCuerpo<{ negocio: NegocioPlaces; tipoWeb: string }>(req);
  const m = await modelo(req, env);
  const r = await generar({ ...m, prompt: P.promptSinWeb(negocio, tipoWeb), esquema: esquemaAnalisisSinWeb });
  const d = parsearJson(r.texto, esquemaAnalisisSinWeb);
  return {
    ...d,
    problemas: d.problemas.slice(0, 5),
    checklist: null,
    correos: [],
    redes: [],
    modelo: r.modelo,
    modo: 'sin web (solo datos de Places)',
    avisos: r.avisos,
  };
}

async function borradores(req: Request, env: Env) {
  const b = await leerCuerpo<{
    negocio: NegocioPlaces;
    analisis: z.infer<typeof esquemaAnalisisSinWeb> | null;
    sinWebPropia: boolean;
    perfil: PerfilVendedor;
    tono: string;
  }>(req);
  const m = await modelo(req, env);
  const r = await generar({
    ...m,
    prompt: P.promptBorradores(b.negocio, b.analisis, b.sinWebPropia, b.perfil, b.tono),
    esquema: esquemaBorradores,
    temperatura: 0.8,
  });
  return { ...parsearJson(r.texto, esquemaBorradores), modelo: r.modelo };
}

async function nichos(req: Request, env: Env) {
  const b = await leerCuerpo<{ zona: string; metricas: MetricaNicho[]; perfil: PerfilVendedor }>(req);
  const m = await modelo(req, env);
  const r = await generar({ ...m, prompt: P.promptNichos(b.zona, b.metricas, b.perfil), esquema: esquemaNichos });
  const d = parsearJson(r.texto, esquemaNichos);
  d.ranking.sort((a, c) => c.puntuacion - a.puntuacion);
  return { ...d, modelo: r.modelo };
}

async function estado(req: Request, env: Env) {
  const gemini = req.headers.get('x-gemini-key') || env.GEMINI_API_KEY;
  const modeloGemini = gemini ? await resolverModelo(gemini, req.headers.get('x-gemini-model')) : null;
  return {
    gemini: Boolean(gemini),
    google: Boolean(req.headers.get('x-google-key') || env.GOOGLE_CLOUD_API_KEY),
    secretos: { gemini: Boolean(env.GEMINI_API_KEY), google: Boolean(env.GOOGLE_CLOUD_API_KEY) },
    modeloGemini,
  };
}

/**
 * Prueba una clave. Para Google usa Text Search pidiendo solo places.id
 * (SKU «IDs Only», sin coste), así que no gasta del cupo de 1.000.
 */
async function probar(req: Request, env: Env) {
  const { servicio } = await leerCuerpo<{ servicio?: string }>(req);
  if (servicio === 'gemini') return { ok: true, detalle: `Funciona. Modelo: ${await probarClave(claveGemini(req, env))}` };
  if (servicio === 'google') {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': claveGoogle(req, env), 'x-goog-fieldmask': 'places.id' },
      body: JSON.stringify({ textQuery: 'farmacia', pageSize: 1 }),
    });
    await comprobar(res, 'Places');
    return { ok: true, detalle: 'Funciona con Places API (New).' };
  }
  throw new ErrorApi('Petición', 400, 'Servicio desconocido.');
}

const RUTAS: Record<string, (req: Request, env: Env) => Promise<unknown>> = {
  'GET /api/estado': estado,
  'POST /api/probar': probar,
  'POST /api/places/search': buscarPlaces,
  'POST /api/pagespeed': pagespeed,
  'POST /api/gemini/analizar-web': analizarWeb,
  'POST /api/gemini/analizar-sin-web': analizarSinWeb,
  'POST /api/gemini/borradores': borradores,
  'POST /api/gemini/nichos': nichos,
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const ruta = RUTAS[`${req.method} ${url.pathname}`];
    if (!ruta) return json({ error: { origen: 'Worker', estado: 404, mensaje: 'Ruta no encontrada' } }, 404);
    try {
      return json(await ruta(req, env));
    } catch (e) {
      if (e instanceof ErrorApi) return json({ error: { origen: e.origen, estado: e.estado, mensaje: e.message } }, e.estado >= 400 ? e.estado : 502);
      const mensaje = e instanceof Error ? e.message : String(e);
      return json({ error: { origen: 'Worker', estado: 500, mensaje } }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
