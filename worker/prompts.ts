import type { MetricaNicho, NegocioPlaces, PerfilVendedor, ResultadoPageSpeed, AnalisisGemini } from '../shared/tipos';

const ESTILO =
  'Escribe siempre en español latino neutro, claro y sin tecnicismos innecesarios. No inventes datos: si algo no se puede comprobar, dilo.';

const SERVICIOS_TXT =
  'Servicios posibles (campo tipo): web_nueva (página web nueva), mejora_web (rehacer o mejorar la web actual), agente_whatsapp (agente de IA que atiende por WhatsApp), sistema_citas (reservas/citas online), app_web (app web a medida para el sector, p. ej. gestión para guarderías).';

function datosNegocio(n: NegocioPlaces): string {
  return JSON.stringify(
    {
      nombre: n.nombre,
      categoria: n.dedicacion,
      tipos: n.tipos,
      direccion: n.direccion,
      telefono: n.telNacional ?? n.telInternacional,
      web: n.web,
      valoracion: n.valoracion,
      reseñas: n.numResenas,
    },
    null,
    1,
  );
}

function datosPageSpeed(ps: ResultadoPageSpeed | null): string {
  if (!ps) return 'No hay datos de PageSpeed.';
  const a = ps.auditorias.map((x) => `- ${x.titulo}: ${x.valor ?? (x.ok ? 'correcto' : 'falla')}`).join('\n');
  return `Notas de PageSpeed en móvil (0-100): rendimiento ${ps.notas.performance}, SEO ${ps.notas.seo}, accesibilidad ${ps.notas.accessibility}, buenas prácticas ${ps.notas.bestPractices}.\n${a}`;
}

const INSTRUCCIONES_ANALISIS = `Quiero:
1. resumen: a qué se dedica el negocio en exactamente dos frases.
2. checklist con estado si/no/desconocido y un detalle breve: https (la web carga con HTTPS), adaptadaMovil, botonWhatsapp (enlace o botón a wa.me / api.whatsapp.com), citaOnline (reserva o cita online), formularioContacto, desactualizada («si» cuando haya señales de web desactualizada: año del copyright antiguo, noticias viejas, diseño anticuado, plugins o enlaces rotos; indica el año si lo ves).
3. correos y redes sociales que aparezcan en la web (solo los que veas, con la URL completa).
4. problemas: entre 3 y 5, explicados en lenguaje llano para el dueño del negocio, centrados en cómo le hacen perder clientes. Usa también las notas de PageSpeed.
5. servicio: qué le ofrecería un vendedor de servicios digitales y por qué, en una o dos frases.
${SERVICIOS_TXT}`;

export function promptAnalisisWeb(n: NegocioPlaces, ps: ResultadoPageSpeed | null): string {
  return `Eres un consultor de presencia digital para negocios locales. ${ESTILO}

Lee y analiza la web de este negocio: ${n.web}

Datos de Google Maps:
${datosNegocio(n)}

${datosPageSpeed(ps)}

${INSTRUCCIONES_ANALISIS}

Responde solo con JSON según el esquema.`;
}

/** Primera de dos llamadas: leer la web con URL context y extraer hechos en texto. */
export function promptLecturaWeb(n: NegocioPlaces): string {
  return `Lee la web ${n.web} (y si hace falta sus páginas de contacto o reservas enlazadas) del negocio «${n.nombre}».
Describe con detalle y de forma literal, sin opinar:
- A qué se dedica y qué servicios o productos ofrece.
- Si carga con https.
- Si hay botón o enlace de WhatsApp (wa.me, api.whatsapp.com) y dónde.
- Si hay sistema de reserva o cita online, formulario de contacto, chat.
- Todos los correos electrónicos y enlaces a redes sociales que aparezcan (con URL completa).
- El año del copyright y cualquier señal de que la web está desactualizada o rota.
- Si el diseño parece adaptado a móvil (viewport, menú, tamaño de texto) según el código.
${ESTILO}`;
}

/** Segunda llamada: estructurar los hechos leídos según el esquema. */
export function promptEstructurarAnalisis(n: NegocioPlaces, ps: ResultadoPageSpeed | null, lectura: string): string {
  return `Eres un consultor de presencia digital para negocios locales. ${ESTILO}

Esto es lo que se observó al leer la web ${n.web}:
"""
${lectura}
"""

Datos de Google Maps:
${datosNegocio(n)}

${datosPageSpeed(ps)}

${INSTRUCCIONES_ANALISIS}

Responde solo con JSON según el esquema.`;
}

export function promptSinWeb(n: NegocioPlaces, tipoWeb: string): string {
  const situacion =
    tipoWeb === 'ninguna'
      ? 'No tiene página web en Google Maps.'
      : `No tiene web propia: en Google Maps solo figura ${n.web} (red social o directorio).`;
  return `Eres un consultor de presencia digital para negocios locales. ${ESTILO}

Datos de Google Maps del negocio:
${datosNegocio(n)}
${situacion}

Quiero:
1. resumen: a qué se dedica el negocio en exactamente dos frases, deducido de su nombre y categoría (sin inventar detalles concretos).
2. problemas: entre 3 y 5 oportunidades que está perdiendo por no tener web propia, en lenguaje llano y adaptadas a su sector.
3. servicio: qué le ofrecería un vendedor de servicios digitales y por qué.
${SERVICIOS_TXT}

Responde solo con JSON según el esquema.`;
}

export function promptBorradores(
  n: NegocioPlaces,
  analisis: Pick<AnalisisGemini, 'resumen' | 'problemas' | 'servicio'> | null,
  sinWebPropia: boolean,
  perfil: PerfilVendedor,
  tono: string,
): string {
  const contexto = analisis
    ? `Resumen: ${analisis.resumen}\nProblemas detectados:\n${analisis.problemas.map((p) => `- ${p.titulo}: ${p.explicacion}`).join('\n')}\nServicio recomendado: ${analisis.servicio.tipo} — ${analisis.servicio.porque}`
    : sinWebPropia
      ? 'El negocio no tiene web propia.'
      : 'Aún no hay análisis de su web.';
  return `Redacta tres borradores para un PRIMER contacto personal (uno a uno, no masivo) con un negocio local. ${ESTILO}

Quién escribe (vendedor):
- Nombre: ${perfil.nombre || '(sin nombre; deja [Tu nombre])'}
- Qué vende: ${perfil.queVendo || 'servicios digitales para negocios locales'}
- Propuesta: ${perfil.propuesta || '(no indicada)'}
Tono pedido: ${tono}. Trata al negocio de usted salvo que el tono sea «cercano».

Negocio:
${datosNegocio(n)}
${contexto}

Reglas:
- Menciona 1 o 2 problemas concretos detectados (sin sonar a crítica ni a alarma) y un beneficio claro.
- Nada de promesas exageradas, ni mayúsculas, ni urgencias falsas. Pide permiso o una conversación breve.
- llamada: guion para leer en voz alta en unos 30 segundos (70-85 palabras), con saludo, motivo, gancho y pregunta final.
- whatsapp: máximo 450 caracteres, presentándose, explicando de dónde sacó el contacto (Google Maps) y con una pregunta abierta. Sin enlaces.
- correo: asunto corto y personalizado (sin «oferta» ni «gratis»), cuerpo de 90-150 palabras, firma con el nombre del vendedor y una línea final ofreciendo no volver a escribir si no le interesa.

Responde solo con JSON según el esquema.`;
}

export function promptNichos(zona: string, metricas: MetricaNicho[], perfil: PerfilVendedor): string {
  return `Eres un estratega comercial para alguien que vende servicios digitales a negocios locales (${perfil.queVendo || 'webs, agentes de IA por WhatsApp, sistemas de citas, apps web'}). ${ESTILO}

Zona: ${zona}
Métricas por categoría (máximo 20 negocios por categoría, de Google Maps):
${JSON.stringify(metricas, null, 1)}

Ordena TODAS las categorías por oportunidad comercial (0-100). Ten en cuenta: alto porcentaje sin web propia, negocios activos (muchas reseñas y buena valoración = pueden pagar y les importa su imagen), volumen de negocios, y si el sector depende de citas o de WhatsApp. En «porque» explica en 1-2 frases por qué; en servicio indica qué venderle a esa categoría.
${SERVICIOS_TXT}
En conclusion, recomienda las tres mejores y explica por qué en 3-4 frases.

Responde solo con JSON según el esquema.`;
}
