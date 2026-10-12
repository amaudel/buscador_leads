import type { z } from 'zod';
import { aJsonSchema } from '../shared/esquemas';
import { ErrorApi, comprobar } from './errores';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO_RESPALDO = 'gemini-flash-latest';

// Modelo elegido por clave (cada clave puede tener acceso a modelos distintos).
const modelosEnCache = new Map<string, { nombre: string; hasta: number }>();

/** Ordena nombres «gemini-X.Y-flash[-preview…]» de más nuevo a más antiguo (estable antes que preview). */
export function elegirFlash(nombres: string[]): string | null {
  const candidatos = nombres
    .map((n) => n.replace(/^models\//, ''))
    .map((n) => {
      const m = /^gemini-(\d+(?:\.\d+)?)-flash(-preview(?:-[\w-]+)?)?$/.exec(n);
      return m ? { n, version: parseFloat(m[1]), preview: Boolean(m[2]) } : null;
    })
    .filter((x): x is { n: string; version: number; preview: boolean } => x !== null);
  candidatos.sort(
    (a, b) => b.version - a.version || Number(a.preview) - Number(b.preview) || b.n.localeCompare(a.n),
  );
  return candidatos[0]?.n ?? null;
}

/** Comprueba que la clave funciona; lanza el error real de la API si no. */
export async function probarClave(clave: string): Promise<string> {
  const res = await fetch(`${BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': clave } });
  const datos = (await comprobar(res, 'Gemini')) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const nombres = (datos.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name);
  return elegirFlash(nombres) ?? MODELO_RESPALDO;
}

export async function resolverModelo(clave: string, forzado?: string | null): Promise<string> {
  if (forzado) return forzado;
  const enCache = modelosEnCache.get(clave);
  if (enCache && enCache.hasta > Date.now()) return enCache.nombre;
  try {
    const res = await fetch(`${BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': clave } });
    const datos = (await comprobar(res, 'Gemini')) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    const nombres = (datos.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name);
    const nombre = elegirFlash(nombres) ?? MODELO_RESPALDO;
    modelosEnCache.set(clave, { nombre, hasta: Date.now() + 6 * 3600_000 });
    return nombre;
  } catch {
    return MODELO_RESPALDO;
  }
}

interface Opciones {
  clave: string;
  modelo: string;
  prompt: string;
  urlContext?: boolean;
  esquema?: z.ZodType;
  temperatura?: number;
}

interface Salida {
  texto: string;
  avisos: string[];
}

export async function generar(o: Opciones): Promise<Salida> {
  const generationConfig: Record<string, unknown> = { temperature: o.temperatura ?? 0.4 };
  if (o.esquema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = aJsonSchema(o.esquema);
  }
  const cuerpo: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: o.prompt }] }],
    generationConfig,
  };
  if (o.urlContext) cuerpo.tools = [{ url_context: {} }];

  const res = await fetch(`${BASE}/models/${encodeURIComponent(o.modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': o.clave },
    body: JSON.stringify(cuerpo),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const datos = (await comprobar(res, 'Gemini')) as any;
  const cand = datos?.candidates?.[0];
  if (!cand) {
    const motivo = datos?.promptFeedback?.blockReason;
    throw new ErrorApi('Gemini', 502, motivo ? `Gemini bloqueó la petición (${motivo}).` : 'Gemini no devolvió respuesta.');
  }
  const texto: string = (cand.content?.parts ?? [])
    .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
    .map((p: { text: string }) => p.text)
    .join('');
  if (!texto) {
    throw new ErrorApi('Gemini', 502, `Gemini devolvió una respuesta vacía (finishReason: ${cand.finishReason ?? 'desconocido'}).`);
  }
  const avisos: string[] = [];
  const metadatos = cand.urlContextMetadata?.urlMetadata ?? cand.url_context_metadata?.url_metadata;
  if (o.urlContext && Array.isArray(metadatos)) {
    for (const m of metadatos) {
      const estado = m.urlRetrievalStatus ?? m.url_retrieval_status;
      if (estado && estado !== 'URL_RETRIEVAL_STATUS_SUCCESS') {
        avisos.push(`No se pudo leer ${m.retrievedUrl ?? m.retrieved_url ?? 'la web'} (${estado}).`);
      }
    }
  }
  return { texto, avisos };
}

export function parsearJson<T>(texto: string, esquema: z.ZodType<T>): T {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let bruto: unknown;
  try {
    bruto = JSON.parse(limpio);
  } catch {
    // A veces llega texto alrededor del JSON: se busca el primer objeto.
    const i = limpio.indexOf('{');
    const f = limpio.lastIndexOf('}');
    if (i < 0 || f <= i) throw new ErrorApi('Gemini', 502, 'Gemini no devolvió JSON válido.');
    try {
      bruto = JSON.parse(limpio.slice(i, f + 1));
    } catch {
      throw new ErrorApi('Gemini', 502, 'Gemini no devolvió JSON válido.');
    }
  }
  const r = esquema.safeParse(bruto);
  if (!r.success) {
    throw new ErrorApi('Gemini', 502, `El JSON de Gemini no cumple el esquema: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
  }
  return r.data;
}

/**
 * Llama con URL context + salida estructurada a la vez. Si la API no admite la
 * combinación (o la salida no es válida), hace dos llamadas: leer y estructurar.
 */
export async function generarConUrl<T>(o: {
  clave: string;
  modelo: string;
  promptUnico: string;
  promptLectura: string;
  promptEstructurar: (lectura: string) => string;
  esquema: z.ZodType<T>;
}): Promise<{ datos: T; modo: string; avisos: string[] }> {
  let motivo = '';
  try {
    const r = await generar({ clave: o.clave, modelo: o.modelo, prompt: o.promptUnico, urlContext: true, esquema: o.esquema });
    return { datos: parsearJson(r.texto, o.esquema), modo: 'una llamada (URL context + JSON)', avisos: r.avisos };
  } catch (e) {
    // Errores de autenticación, cuota o modelo no se arreglan con dos llamadas.
    if (e instanceof ErrorApi && [401, 403, 404, 429].includes(e.estado)) throw e;
    motivo = e instanceof Error ? e.message : String(e);
  }
  const lectura = await generar({ clave: o.clave, modelo: o.modelo, prompt: o.promptLectura, urlContext: true, temperatura: 0.2 });
  const r2 = await generar({ clave: o.clave, modelo: o.modelo, prompt: o.promptEstructurar(lectura.texto), esquema: o.esquema });
  return {
    datos: parsearJson(r2.texto, o.esquema),
    modo: 'dos llamadas (lectura + JSON)',
    avisos: [...lectura.avisos, `Se usaron dos llamadas porque la combinada falló: ${motivo.slice(0, 200)}`],
  };
}
