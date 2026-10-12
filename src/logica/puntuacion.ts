import type { Analisis, Negocio } from '../../shared/tipos';

export interface Puntuacion {
  total: number;
  provisional: boolean;
  etiqueta: string | null; // p. ej. «Sin web»
  desglose: { motivo: string; puntos: number }[];
}

const BASE = 30;

/**
 * Oportunidad de 0 a 100. Sube si no tiene web propia, si su web es mala o le
 * faltan WhatsApp/citas, y si el negocio está activo. Baja si la web ya es buena
 * o si el negocio apenas tiene actividad.
 */
export function puntuar(n: Negocio, a?: Analisis | null): Puntuacion {
  const d: { motivo: string; puntos: number }[] = [{ motivo: 'Base', puntos: BASE }];
  const sum = (motivo: string, puntos: number) => d.push({ motivo, puntos });

  if (n.estadoNegocio && n.estadoNegocio !== 'OPERATIONAL') {
    const motivo = n.estadoNegocio === 'CLOSED_PERMANENTLY' ? 'Cerrado definitivamente' : 'Cerrado temporalmente';
    return { total: 0, provisional: !a, etiqueta: 'Cerrado', desglose: [{ motivo, puntos: 0 }] };
  }

  // Presencia web
  if (n.tipoWeb === 'ninguna') sum('No tiene página web', 35);
  else if (n.tipoWeb === 'red_social') sum('Solo tiene red social o Linktree, sin web propia', 30);
  else if (n.tipoWeb === 'directorio') sum('Solo figura en un directorio, sin web propia', 30);

  // Actividad del negocio
  if (n.numResenas >= 50) sum(`Negocio muy activo (${n.numResenas} reseñas)`, 15);
  else if (n.numResenas >= 15) sum(`Negocio activo (${n.numResenas} reseñas)`, 8);
  else if (n.numResenas < 5) sum(`Apenas tiene actividad (${n.numResenas} reseñas)`, -15);

  if (n.valoracion != null) {
    if (n.valoracion >= 4.3) sum(`Buena valoración (${n.valoracion.toFixed(1)})`, 10);
    else if (n.valoracion < 3.5) sum(`Valoración baja (${n.valoracion.toFixed(1)})`, -5);
  }

  if (n.telNacional || n.telInternacional) sum('Tiene teléfono para contactar', 5);
  else sum('Sin teléfono en Google Maps', -5);

  // Con análisis de la web propia
  const ps = a?.pagespeed?.notas;
  if (ps?.performance != null) {
    if (ps.performance < 50) sum(`Web lenta en móvil (rendimiento ${ps.performance})`, 15);
    else if (ps.performance < 90) sum(`Rendimiento mejorable en móvil (${ps.performance})`, 5);
    else sum(`Web rápida en móvil (rendimiento ${ps.performance})`, -15);
  }
  if (ps && (ps.seo ?? 0) >= 90 && (ps.accessibility ?? 0) >= 90) sum('Buen SEO y accesibilidad', -10);

  const c = a?.gemini?.checklist;
  if (c && n.tipoWeb === 'propia') {
    if (c.botonWhatsapp.estado === 'no') sum('Sin botón de WhatsApp', 8);
    if (c.citaOnline.estado === 'no') sum('Sin cita o reserva online', 8);
    if (c.https.estado === 'no') sum('Sin HTTPS', 7);
    if (c.adaptadaMovil.estado === 'no') sum('No adaptada a móvil', 7);
    if (c.desactualizada.estado === 'si') sum('Señales de web desactualizada', 5);
    if (c.formularioContacto.estado === 'no') sum('Sin formulario de contacto', 3);
  }

  const total = Math.max(0, Math.min(100, d.reduce((s, x) => s + x.puntos, 0)));
  const provisional = n.tipoWeb === 'propia' ? !a?.pagespeed && !a?.gemini : !a?.gemini;
  return { total, provisional, etiqueta: n.tipoWeb === 'propia' ? null : 'Sin web', desglose: d };
}

/** Color semántico de una nota 0-100. */
export function colorNota(v: number | null | undefined): 'rojo' | 'ambar' | 'verde' | 'gris' {
  if (v == null) return 'gris';
  if (v < 50) return 'rojo';
  if (v < 90) return 'ambar';
  return 'verde';
}

/** Para la oportunidad la escala se invierte: alta oportunidad = verde. */
export function colorOportunidad(v: number): 'rojo' | 'ambar' | 'verde' {
  if (v >= 70) return 'verde';
  if (v >= 45) return 'ambar';
  return 'rojo';
}
