import type { Page } from '@playwright/test';

const lugar = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `p${i}`,
  nombre: `Taller ${['Pérez', 'Andino', 'El Rápido', 'Motores Cuenca', 'AutoFix'][(i - 1) % 5]} ${i}`,
  dedicacion: 'Taller de reparación de automóviles',
  tipos: ['car_repair'],
  direccion: `Av. Huayna Cápac ${100 + i}, Cuenca, Ecuador`,
  ubicacion: { lat: -2.9, lng: -79 },
  telNacional: `07-28${i}-4567`,
  telInternacional: `+593 7-28${i}-4567`,
  web: null,
  valoracion: 4.1 + (i % 9) / 10,
  numResenas: 5 + i * 13,
  mapsUrl: `https://maps.google.com/?cid=${i}`,
  estadoNegocio: 'OPERATIONAL',
  ...extra,
});

export const pagina1 = [
  lugar(1, { web: 'https://tallerperez.com.ec' }),
  lugar(2, { web: 'https://www.facebook.com/tallerandino' }),
  lugar(3),
  lugar(4, { telNacional: null, telInternacional: null, numResenas: 2 }),
  lugar(5, { estadoNegocio: 'CLOSED_PERMANENTLY' }),
  lugar(6, { web: 'https://autofix.ec' }),
];
export const pagina2 = [lugar(7), lugar(8, { web: 'https://linktr.ee/motores' })];

// Captura simulada: SVG de un móvil.
const captura =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640"><rect width="360" height="640" fill="#f5f5f5"/><rect width="360" height="70" fill="#223"/><text x="20" y="45" fill="#fff" font-size="22" font-family="Arial">Taller Pérez</text><rect x="20" y="100" width="320" height="180" fill="#ccd"/><text x="20" y="330" font-size="16" font-family="Arial">Reparación y mantenimiento</text><text x="20" y="610" font-size="12" font-family="Arial" fill="#888">© 2016 Taller Pérez</text></svg>`,
  ).toString('base64');

export async function simularApi(page: Page) {
  await page.route('**/api/estado', (r) => {
    const h = r.request().headers();
    r.fulfill({ json: { gemini: Boolean(h['x-gemini-key']), google: Boolean(h['x-google-key']), secretos: { gemini: false, google: false }, modeloGemini: h['x-gemini-key'] ? 'gemini-2.5-flash' : null } });
  });
  await page.route('**/api/probar', (r) => {
    const { servicio } = r.request().postDataJSON();
    const h = r.request().headers();
    const clave = servicio === 'gemini' ? h['x-gemini-key'] : h['x-google-key'];
    if (clave === 'mala') return r.fulfill({ status: 400, json: { error: { origen: 'Gemini', estado: 400, mensaje: 'API key not valid. Please pass a valid API key.' } } });
    r.fulfill({ json: { ok: true, detalle: servicio === 'gemini' ? 'Funciona. Modelo: gemini-2.5-flash' : 'Funciona con Places API (New).' } });
  });
  await page.route('**/api/places/search', async (r) => {
    const b = r.request().postDataJSON();
    await new Promise((x) => setTimeout(x, 300));
    if (b.textQuery.startsWith('error')) return r.fulfill({ status: 403, json: { error: { origen: 'Places', estado: 403, mensaje: 'Places API (New) has not been used in project 1234 before or it is disabled.' } } });
    if (b.pageToken) return r.fulfill({ json: { negocios: pagina2, nextPageToken: null } });
    if (!b.textQuery.startsWith('talleres')) return r.fulfill({ json: { negocios: pagina1.slice(0, 3 + (b.textQuery.length % 3)), nextPageToken: null } });
    return r.fulfill({ json: { negocios: pagina1, nextPageToken: 'tok' } });
  });
  await page.route('**/api/pagespeed', async (r) => {
    await new Promise((x) => setTimeout(x, 600));
    r.fulfill({
      json: {
        urlFinal: 'https://tallerperez.com.ec/',
        notas: { performance: 34, seo: 82, accessibility: 71, bestPractices: 96 },
        captura,
        auditorias: [
          { id: 'largest-contentful-paint', titulo: 'Largest Contentful Paint', valor: '6,8 s', ok: false },
          { id: 'total-blocking-time', titulo: 'Total Blocking Time', valor: '920 ms', ok: false },
          { id: 'cumulative-layout-shift', titulo: 'Cumulative Layout Shift', valor: '0,02', ok: true },
        ],
      },
    });
  });
  const base = { modelo: 'gemini-2.5-flash', avisos: [] };
  await page.route('**/api/gemini/analizar-web', async (r) => {
    await new Promise((x) => setTimeout(x, 800));
    r.fulfill({
      json: {
        ...base,
        modo: 'una llamada (URL context + JSON)',
        resumen: 'Taller Pérez es un taller mecánico de Cuenca especializado en mantenimiento y reparación de vehículos livianos. Ofrece diagnóstico computarizado, frenos y suspensión.',
        checklist: {
          https: { estado: 'si', detalle: 'Carga con HTTPS' },
          adaptadaMovil: { estado: 'si', detalle: 'Tiene viewport, pero el menú se corta en pantallas pequeñas' },
          botonWhatsapp: { estado: 'no', detalle: 'Solo aparece el teléfono fijo' },
          citaOnline: { estado: 'no', detalle: 'No hay forma de reservar turno online' },
          formularioContacto: { estado: 'si', detalle: 'Formulario básico en /contacto' },
          desactualizada: { estado: 'si', detalle: 'Copyright © 2016 y noticias de 2017' },
        },
        correos: ['info@tallerperez.com.ec'],
        redes: [{ red: 'Facebook', url: 'https://facebook.com/tallerperez' }],
        problemas: [
          { titulo: 'La web tarda casi 7 segundos en cargar en el celular', explicacion: 'Muchos clientes se van antes de ver el teléfono.' },
          { titulo: 'No hay botón de WhatsApp', explicacion: 'Hoy la mayoría prefiere escribir antes que llamar.' },
          { titulo: 'No se puede pedir turno online', explicacion: 'Pierde clientes que buscan fuera del horario.' },
          { titulo: 'Se ve desactualizada (2016)', explicacion: 'Transmite poca confianza frente a la competencia.' },
        ],
        servicio: { tipo: 'agente_whatsapp', porque: 'Tiene muchas reseñas y clientela fiel; un agente de WhatsApp con agenda de turnos le ahorraría llamadas.' },
      },
    });
  });
  await page.route('**/api/gemini/analizar-sin-web', async (r) => {
    await new Promise((x) => setTimeout(x, 500));
    r.fulfill({
      json: {
        ...base, modo: 'sin web (solo datos de Places)', checklist: null, correos: [], redes: [],
        resumen: 'Taller mecánico en Cuenca con buena reputación. Atiende reparaciones generales de autos.',
        problemas: [
          { titulo: 'Nadie lo encuentra fuera de Maps', explicacion: 'Sin web no aparece en búsquedas de servicios concretos.' },
          { titulo: 'No muestra sus servicios ni precios', explicacion: 'El cliente tiene que llamar para todo.' },
          { titulo: 'No recibe turnos fuera de horario', explicacion: 'Pierde clientes por la noche y fines de semana.' },
        ],
        servicio: { tipo: 'web_nueva', porque: 'Una web sencilla con botón de WhatsApp y reserva aprovecharía sus buenas reseñas.' },
      },
    });
  });
  await page.route('**/api/gemini/borradores', async (r) => {
    const b = r.request().postDataJSON();
    await new Promise((x) => setTimeout(x, 400));
    r.fulfill({
      json: {
        modelo: 'gemini-2.5-flash',
        llamada: `Buenos días, ¿hablo con el encargado de ${b.negocio.nombre}? Le saluda ${b.perfil.nombre || '[Tu nombre]'}. Vi su taller en Google Maps y tiene reseñas muy buenas. Revisé su página y en el celular tarda casi siete segundos en cargar y no tiene botón de WhatsApp, así que algunos clientes se pierden. Ayudo a talleres de Cuenca a recibir turnos por WhatsApp de forma automática. ¿Le parece si le cuento en cinco minutos cómo funcionaría para ustedes?`,
        whatsapp: `Hola, buenas tardes. Soy ${b.perfil.nombre || '[Tu nombre]'}, encontré ${b.negocio.nombre} en Google Maps. Vi que su web tarda en cargar en el celular y no tiene WhatsApp para pedir turno. Trabajo con talleres de la ciudad justo en eso. ¿Le interesaría que le muestre una idea rápida, sin compromiso? (Tono ${b.tono})`,
        correo: { asunto: `Una idea para los turnos de ${b.negocio.nombre}`, cuerpo: `Estimado equipo de ${b.negocio.nombre}:\n\nLes escribo porque vi su taller en Google Maps…\n\nSaludos,\n${b.perfil.nombre || '[Tu nombre]'}\n\nSi no les interesa, no volveré a escribir.` },
      },
    });
  });
  await page.route('**/api/gemini/nichos', async (r) => {
    const b = r.request().postDataJSON();
    await new Promise((x) => setTimeout(x, 500));
    const ranking = b.metricas
      .map((m: { categoria: string; pctSinWeb: number; mediaResenas: number }) => ({
        categoria: m.categoria,
        puntuacion: Math.min(98, Math.round(m.pctSinWeb * 0.7 + Math.min(30, m.mediaResenas / 2))),
        porque: `${m.pctSinWeb}% sin web propia y buena actividad media.`,
        servicio: m.categoria.includes('clín') || m.categoria.includes('fisio') ? 'sistema_citas' : m.pctSinWeb > 50 ? 'web_nueva' : 'agente_whatsapp',
      }))
      .sort((a: { puntuacion: number }, c: { puntuacion: number }) => c.puntuacion - a.puntuacion);
    r.fulfill({ json: { modelo: 'gemini-2.5-flash', ranking, conclusion: `Las tres mejores son ${ranking.slice(0, 3).map((x: { categoria: string }) => x.categoria).join(', ')}: mucha actividad y poca presencia web propia.` } });
  });
}
