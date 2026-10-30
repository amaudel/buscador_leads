// Tipos compartidos entre la app (navegador) y el Worker.

export type TipoWeb = 'propia' | 'red_social' | 'directorio' | 'ninguna';

/** Negocio tal como lo devuelve Places, ya normalizado. */
export interface NegocioPlaces {
  id: string;
  nombre: string;
  dedicacion: string | null;
  tipos: string[];
  direccion: string | null;
  ubicacion: { lat: number; lng: number } | null;
  telNacional: string | null;
  telInternacional: string | null;
  web: string | null;
  valoracion: number | null;
  numResenas: number;
  mapsUrl: string | null;
  estadoNegocio: string | null;
}

export interface Negocio extends NegocioPlaces {
  tipoWeb: TipoWeb;
  nicho: string;
  zona: string;
  vistoEn: string;
}

export interface RespuestaPlaces {
  negocios: NegocioPlaces[];
  nextPageToken: string | null;
}

export type EstadoLead =
  | 'nuevo'
  | 'analizado'
  | 'contactado'
  | 'respondio'
  | 'reunion'
  | 'cliente'
  | 'descartado';

export const ESTADOS: { id: EstadoLead; etiqueta: string }[] = [
  { id: 'nuevo', etiqueta: 'Nuevo' },
  { id: 'analizado', etiqueta: 'Analizado' },
  { id: 'contactado', etiqueta: 'Contactado' },
  { id: 'respondio', etiqueta: 'Respondió' },
  { id: 'reunion', etiqueta: 'Reunión' },
  { id: 'cliente', etiqueta: 'Cliente' },
  { id: 'descartado', etiqueta: 'Descartado' },
];

export interface ContactoComercial {
  nombre: string;
  cargo: string;
  email: string | null;
  verificacion: 'valid' | 'invalid' | 'accept_all' | 'unknown';
  proveedor: string;
  fecha: string;
  callId: string | null;
  costoUsd: number;
}

export interface Lead {
  negocioId: string;
  contacto?: ContactoComercial;
  estado: EstadoLead;
  notas: string;
  proximaAccion: string | null; // AAAA-MM-DD
  creado: string;
  actualizado: string;
}

export interface NotasPageSpeed {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
}

export interface ResultadoPageSpeed {
  urlFinal: string;
  notas: NotasPageSpeed;
  captura: string | null; // data:image/...;base64
  auditorias: { id: string; titulo: string; valor: string | null; ok: boolean | null }[];
}

export type EstadoCheck = 'si' | 'no' | 'desconocido';

export interface ItemCheck {
  estado: EstadoCheck;
  detalle: string;
}

export type TipoServicio =
  | 'web_nueva'
  | 'mejora_web'
  | 'agente_whatsapp'
  | 'sistema_citas'
  | 'app_web';

export const SERVICIOS: Record<TipoServicio, string> = {
  web_nueva: 'Web nueva',
  mejora_web: 'Mejora de la web actual',
  agente_whatsapp: 'Agente de IA por WhatsApp',
  sistema_citas: 'Sistema de citas',
  app_web: 'App web a medida',
};

export interface AnalisisGemini {
  resumen: string;
  checklist: {
    https: ItemCheck;
    adaptadaMovil: ItemCheck;
    botonWhatsapp: ItemCheck;
    citaOnline: ItemCheck;
    formularioContacto: ItemCheck;
    desactualizada: ItemCheck; // «si» = hay señales de web desactualizada
  } | null;
  correos: string[];
  redes: { red: string; url: string }[];
  problemas: { titulo: string; explicacion: string }[];
  servicio: { tipo: TipoServicio; porque: string };
}

export interface Analisis {
  negocioId: string;
  fecha: string;
  web: string | null;
  pagespeed: ResultadoPageSpeed | null;
  gemini: (AnalisisGemini & { modelo: string; modo: string; avisos: string[] }) | null;
  errores: string[];
}

export interface Borradores {
  negocioId: string;
  tono: string;
  fecha: string;
  llamada: string;
  whatsapp: string;
  correo: { asunto: string; cuerpo: string };
}

export interface PerfilVendedor {
  nombre: string;
  queVendo: string;
  propuesta: string;
  tono: string;
}

export interface MetricaNicho {
  categoria: string;
  total: number;
  pctSinWeb: number;
  mediaValoracion: number | null;
  mediaResenas: number;
}

export interface RankingNichos {
  ranking: { categoria: string; puntuacion: number; porque: string; servicio: TipoServicio }[];
  conclusion: string;
}

export interface RadarNichos {
  clave: string;
  zona: string;
  fecha: string;
  metricas: MetricaNicho[];
  ranking: (RankingNichos & { modelo: string }) | null;
}

/** Formato de error que devuelve el Worker. */
export interface ErrorApi {
  error: { origen: string; estado: number; mensaje: string };
}

export const TONOS = ['profesional', 'cercano', 'directo', 'entusiasta', 'consultivo'];
