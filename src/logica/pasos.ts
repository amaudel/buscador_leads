// El proceso de venta de la app y en qué paso está cada negocio.
import type { Analisis, Borradores, EstadoLead, Lead } from '../../shared/tipos';

export type PasoId = 'datos' | 'analisis' | 'dueno' | 'mensajes' | 'seguimiento';

export const PASOS: { id: PasoId; n: number; titulo: string; ayuda: string }[] = [
  { id: 'datos', n: 1, titulo: 'Datos', ayuda: 'Contacto y nota de oportunidad' },
  { id: 'analisis', n: 2, titulo: 'Análisis', ayuda: 'Qué le falta a su web o presencia digital' },
  { id: 'dueno', n: 3, titulo: 'Dueño y contacto', ayuda: 'Quién decide y cómo llegarle' },
  { id: 'mensajes', n: 4, titulo: 'Mensajes', ayuda: 'Guion de llamada, WhatsApp y correo' },
  { id: 'seguimiento', n: 5, titulo: 'Seguimiento', ayuda: 'Estado, notas y próxima acción' },
];

export type Accion = 'guardar' | 'analizar' | 'dueno' | 'mensajes' | 'contactar' | 'seguimiento' | 'ninguna';

export interface Progreso {
  guardado: boolean;
  analizado: boolean;
  dueno: boolean;
  mensajes: boolean;
  contactado: boolean;
}

const YA_CONTACTADO: EstadoLead[] = ['contactado', 'respondio', 'reunion', 'cliente', 'descartado'];

export function progreso(lead?: Lead | null, analisis?: Analisis | null, borradores?: Borradores | null): Progreso {
  return {
    guardado: Boolean(lead),
    analizado: Boolean(analisis?.gemini || analisis?.pagespeed),
    dueno: Boolean(lead?.contacto?.nombre),
    mensajes: Boolean(borradores),
    contactado: Boolean(lead && YA_CONTACTADO.includes(lead.estado)),
  };
}

export const hoyIso = () => new Date().toISOString().slice(0, 10);

export interface Siguiente {
  paso: PasoId;
  accion: Accion;
  texto: string; // «Siguiente paso: …»
  corto: string; // chip en listas
  boton: string;
}

/** Qué conviene hacer ahora con este negocio. */
export function siguientePaso(lead?: Lead | null, analisis?: Analisis | null, borradores?: Borradores | null): Siguiente {
  const p = progreso(lead, analisis, borradores);
  if (lead?.estado === 'cliente') return { paso: 'seguimiento', accion: 'ninguna', texto: '¡Es tu cliente! Anota aquí lo que vendiste.', corto: 'Cliente 🎉', boton: '' };
  if (lead?.estado === 'descartado') return { paso: 'seguimiento', accion: 'ninguna', texto: 'Descartado. Puedes reactivarlo cambiando el estado.', corto: 'Descartado', boton: '' };
  if (!p.guardado) return { paso: 'datos', accion: 'guardar', texto: 'Guárdalo en tus leads para no perderlo.', corto: 'Guardar', boton: 'Guardar en mis leads' };
  if (p.contactado) {
    const vence = lead?.proximaAccion && lead.proximaAccion <= hoyIso();
    if (vence) return { paso: 'seguimiento', accion: 'seguimiento', texto: 'Hoy toca hacerle seguimiento.', corto: 'Seguimiento hoy', boton: 'Ver seguimiento' };
    if (lead?.estado === 'reunion') return { paso: 'seguimiento', accion: 'seguimiento', texto: 'Prepara la reunión y anota los acuerdos.', corto: 'Preparar reunión', boton: 'Ver seguimiento' };
    if (lead?.estado === 'respondio') return { paso: 'seguimiento', accion: 'seguimiento', texto: 'Te respondió: agenda una reunión.', corto: 'Agendar reunión', boton: 'Ver seguimiento' };
    return { paso: 'seguimiento', accion: 'seguimiento', texto: 'Espera respuesta y pon fecha a la próxima acción.', corto: 'Esperando respuesta', boton: 'Ver seguimiento' };
  }
  if (!p.analizado) return { paso: 'analisis', accion: 'analizar', texto: 'Analiza su web para saber qué ofrecerle.', corto: 'Analizar', boton: 'Analizar ahora' };
  if (!p.dueno) return { paso: 'dueno', accion: 'dueno', texto: 'Averigua quién es el dueño o quién decide.', corto: 'Buscar dueño', boton: 'Buscar dueño' };
  if (!p.mensajes) return { paso: 'mensajes', accion: 'mensajes', texto: 'Prepara el primer mensaje personalizado.', corto: 'Redactar mensaje', boton: 'Redactar mensajes' };
  return { paso: 'seguimiento', accion: 'contactar', texto: 'Llámalo o escríbele y márcalo como contactado.', corto: 'Contactar', boton: 'Ya lo contacté' };
}

/** Fecha AAAA-MM-DD dentro de n días. */
export function enDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
