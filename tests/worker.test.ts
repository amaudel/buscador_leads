import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLACES_FIELD_MASK } from '../shared/places';
import { elegirFlash } from '../worker/gemini';
import worker, { mapearPageSpeed, type Env } from '../worker/index';

const env = (p: Partial<Env> = {}): Env => ({
  ASSETS: { fetch: async () => new Response('spa') } as unknown as Fetcher,
  GEMINI_API_KEY: 'g-key',
  GOOGLE_CLOUD_API_KEY: 'c-key',
  ...p,
});

const post = (ruta: string, cuerpo: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://radar.test${ruta}`, { method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json', ...headers } });

const respuesta = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('elegirFlash', () => {
  it('elige el Flash más nuevo, estable antes que preview, sin lite', () => {
    expect(elegirFlash(['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.5-pro'])).toBe('gemini-2.5-flash');
    expect(elegirFlash(['models/gemini-2.5-flash', 'models/gemini-3-flash-preview'])).toBe('gemini-3-flash-preview');
    expect(elegirFlash(['models/gemini-3-flash', 'models/gemini-3-flash-preview'])).toBe('gemini-3-flash');
    expect(elegirFlash(['models/gemini-2.5-pro'])).toBeNull();
  });
});

describe('Places', () => {
  it('envía field mask, idioma, región, pageSize y pageToken, y mapea la respuesta', async () => {
    const f = vi.fn(async () => respuesta({ places: [{ id: 'p1', displayName: { text: 'Taller' }, userRatingCount: 12, websiteUri: 'https://t.com' }], nextPageToken: 'tok2' }));
    vi.stubGlobal('fetch', f);
    const res = await worker.fetch(post('/api/places/search', { textQuery: 'talleres en Cuenca', regionCode: 'ec', pageToken: 'tok1' }), env());
    const datos = (await res.json()) as { negocios: { nombre: string; numResenas: number }[]; nextPageToken: string };
    expect(res.status).toBe(200);
    expect(datos.negocios[0]).toMatchObject({ nombre: 'Taller', numResenas: 12 });
    expect(datos.nextPageToken).toBe('tok2');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    const h = init.headers as Record<string, string>;
    expect(h['x-goog-fieldmask']).toBe(PLACES_FIELD_MASK);
    expect(h['x-goog-api-key']).toBe('c-key');
    expect(JSON.parse(init.body as string)).toEqual({ textQuery: 'talleres en Cuenca', languageCode: 'es', regionCode: 'EC', pageSize: 20, pageToken: 'tok1' });
  });

  it('devuelve el mensaje real de la API cuando falla', async () => {
    vi.stubGlobal('fetch', async () => respuesta({ error: { code: 403, message: 'Places API (New) has not been used in project 123' } }, 403));
    const res = await worker.fetch(post('/api/places/search', { textQuery: 'x' }), env());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { origen: 'Places', estado: 403, mensaje: 'Places API (New) has not been used in project 123' } });
  });

  it('usa la clave del navegador si no hay secreto, y avisa si falta', async () => {
    const f = vi.fn(async () => respuesta({ places: [] }));
    vi.stubGlobal('fetch', f);
    await worker.fetch(post('/api/places/search', { textQuery: 'x' }, { 'x-google-key': 'nav-key' }), env({ GOOGLE_CLOUD_API_KEY: undefined }));
    expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)['x-goog-api-key']).toBe('nav-key');
    const res = await worker.fetch(post('/api/places/search', { textQuery: 'x' }), env({ GOOGLE_CLOUD_API_KEY: undefined }));
    expect(res.status).toBe(400);
  });
});

describe('PageSpeed', () => {
  it('mapea notas, captura y auditorías', () => {
    const r = mapearPageSpeed({
      lighthouseResult: {
        finalDisplayedUrl: 'https://t.com/',
        categories: { performance: { score: 0.42 }, seo: { score: 0.9 }, accessibility: { score: 0.77 }, 'best-practices': { score: 1 } },
        audits: { 'final-screenshot': { details: { data: 'data:image/jpeg;base64,AAA' } }, 'largest-contentful-paint': { title: 'LCP', displayValue: '5,1 s', score: 0.2 } },
      },
    });
    expect(r.notas).toEqual({ performance: 42, seo: 90, accessibility: 77, bestPractices: 100 });
    expect(r.captura).toBe('data:image/jpeg;base64,AAA');
    expect(r.auditorias).toEqual([{ id: 'largest-contentful-paint', titulo: 'LCP', valor: '5,1 s', ok: false }]);
  });

  it('pide estrategia móvil y las cuatro categorías', async () => {
    const f = vi.fn(async () => respuesta({ lighthouseResult: { categories: {}, audits: {} } }));
    vi.stubGlobal('fetch', f);
    await worker.fetch(post('/api/pagespeed', { url: 'https://t.com' }), env());
    const url = new URL((f.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get('strategy')).toBe('mobile');
    expect(url.searchParams.getAll('category')).toEqual(['performance', 'seo', 'accessibility', 'best-practices']);
  });
});

describe('Gemini', () => {
  const analisisOk = {
    resumen: 'Taller. Repara coches.',
    checklist: Object.fromEntries(['https', 'adaptadaMovil', 'botonWhatsapp', 'citaOnline', 'formularioContacto', 'desactualizada'].map((k) => [k, { estado: 'no', detalle: '' }])),
    correos: [], redes: [],
    problemas: [1, 2, 3, 4, 5, 6].map((i) => ({ titulo: `P${i}`, explicacion: '' })),
    servicio: { tipo: 'mejora_web', porque: 'x' },
  };
  const gen = (texto: string) => respuesta({ candidates: [{ content: { parts: [{ text: texto }] }, urlContextMetadata: { urlMetadata: [{ retrievedUrl: 'https://t.com', urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] } }] });
  const negocio = { id: 'p1', nombre: 'Taller', web: 'https://t.com', tipos: [], numResenas: 3 };

  it('una llamada con url_context + JSON cuando la API lo admite', async () => {
    const f = vi.fn(async () => gen(JSON.stringify(analisisOk)));
    vi.stubGlobal('fetch', f);
    const res = await worker.fetch(post('/api/gemini/analizar-web', { negocio, pagespeed: null }, { 'x-gemini-model': 'gemini-x-flash' }), env());
    const d = (await res.json()) as { problemas: unknown[]; modo: string; modelo: string };
    expect(res.status).toBe(200);
    expect(d.problemas).toHaveLength(5);
    expect(d.modelo).toBe('gemini-x-flash');
    expect(d.modo).toMatch(/una llamada/);
    const cuerpo = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(cuerpo.tools).toEqual([{ url_context: {} }]);
    expect(cuerpo.generationConfig.responseMimeType).toBe('application/json');
    expect(cuerpo.generationConfig.responseJsonSchema.properties.checklist).toBeDefined();
  });

  it('hace dos llamadas si la combinación no está soportada', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(respuesta({ error: { code: 400, message: 'Tool use with a response mime type is unsupported' } }, 400))
      .mockResolvedValueOnce(gen('La web ofrece reparaciones…'))
      .mockResolvedValueOnce(gen('```json\n' + JSON.stringify(analisisOk) + '\n```'));
    vi.stubGlobal('fetch', f);
    const res = await worker.fetch(post('/api/gemini/analizar-web', { negocio, pagespeed: null }, { 'x-gemini-model': 'gemini-x-flash' }), env());
    const d = (await res.json()) as { modo: string };
    expect(res.status).toBe(200);
    expect(d.modo).toMatch(/dos llamadas/);
    const c2 = JSON.parse((f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    const c3 = JSON.parse((f.mock.calls[2] as unknown as [string, RequestInit])[1].body as string);
    expect(c2.tools).toBeDefined();
    expect(c2.generationConfig.responseMimeType).toBeUndefined();
    expect(c3.tools).toBeUndefined();
    expect(c3.generationConfig.responseJsonSchema).toBeDefined();
  });

  it('no reintenta con dos llamadas ante errores de clave', async () => {
    const f = vi.fn(async () => respuesta({ error: { code: 403, message: 'API key not valid' } }, 403));
    vi.stubGlobal('fetch', f);
    const res = await worker.fetch(post('/api/gemini/analizar-web', { negocio, pagespeed: null }, { 'x-gemini-model': 'm' }), env());
    expect(res.status).toBe(403);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('error claro si falta GEMINI_API_KEY', async () => {
    const res = await worker.fetch(post('/api/gemini/nichos', { zona: 'x', metricas: [], perfil: {} }), env({ GEMINI_API_KEY: undefined }));
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { mensaje: string } }).error.mensaje).toMatch(/GEMINI_API_KEY/);
  });
});

describe('rutas', () => {
  it('sirve la SPA fuera de /api', async () => {
    const res = await worker.fetch(new Request('https://radar.test/leads'), env());
    expect(await res.text()).toBe('spa');
  });
});
