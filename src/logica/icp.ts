import type { Analisis, Negocio } from '../../shared/tipos';

/** Puntuación heurística, no probabilidad estadística de compra. */
export type PerfilICP = 'web' | 'nixgofood' | 'nidocerca' | 'whatsapp' | 'citas';
export const PERFILES: Record<PerfilICP, { nombre: string; descripcion: string }> = {
  web: { nombre: 'Sitio web profesional', descripcion: 'Empresas que podrían beneficiarse de presencia web propia.' },
  nixgofood: { nombre: 'NixgoFood', descripcion: 'Restaurantes y comercios de comida preparada.' },
  nidocerca: { nombre: 'NidoCerca', descripcion: 'Centros infantiles y educación inicial.' },
  whatsapp: { nombre: 'Agente de WhatsApp', descripcion: 'Empresas con atención recurrente y consultas frecuentes.' },
  citas: { nombre: 'Reservas y citas', descripcion: 'Servicios donde la programación de turnos es habitual.' },
};
const SECTORES: Record<Exclude<PerfilICP, 'web'>, RegExp> = {
  nixgofood: /restaur|cafeter|comida|pizzer|hamburg|poller|panader|sushi|catering|cevicher|fast.food|food/i,
  nidocerca: /guarder|centro.infantil|educaci[oó]n.inicial|jard[ií]n.infantil|preescolar|maternal|nursery|childcare/i,
  whatsapp: /cl[ií]nica|consultorio|sal[oó]n|peluquer|est[eé]tica|odont|dent|veterinar|restaur|taller|reparaci[oó]n|inmobiliaria|hotel/i,
  citas: /cl[ií]nica|consultorio|odont|dent|fisioterap|m[eé]dic|sal[oó]n|peluquer|est[eé]tica|veterinar|psic[oó]log|spa/i,
};

export interface EvaluacionICP {
  puntuacion: number;
  coincidencia: boolean;
  confianza: 'preliminar' | 'con-evidencia';
  motivos: { texto: string; puntos: number }[];
  porComprobar: string[];
}

export function evaluarICP(n: Negocio, a: Analisis | null | undefined, perfil: PerfilICP): EvaluacionICP {
  if (n.estadoNegocio && n.estadoNegocio !== 'OPERATIONAL') {
    return { puntuacion: 0, coincidencia: false, confianza: 'preliminar', motivos: [{ texto: 'Negocio no operativo', puntos: 0 }], porComprobar: ['Verificar si ha reabierto'] };
  }
  const motivos: EvaluacionICP['motivos'] = [];
  const porComprobar: string[] = [];
  const sumar = (texto: string, puntos: number) => motivos.push({ texto, puntos });

  const sector = [n.dedicacion, n.nicho, ...(n.tipos || [])].filter(Boolean).join(' ');
  const coincidencia = perfil === 'web' || SECTORES[perfil].test(sector);
  if (coincidencia) sumar('Sector compatible con el producto', 35);
  else porComprobar.push('La categoría no corresponde al perfil de cliente ideal');

  // Las reseñas indican actividad pública, no capacidad de pago ni intención de compra.
  if (n.numResenas >= 50) sumar('Actividad pública: 50 o más reseñas', 15);
  else if (n.numResenas >= 15) sumar('Actividad pública: al menos 15 reseñas', 8);
  else porComprobar.push('Actividad y tamaño comercial insuficientemente acreditados');

  if (n.valoracion != null && n.valoracion >= 4.3 && n.numResenas >= 15) sumar('Buena valoración con muestra mínima', 5);
  if (n.telNacional || n.telInternacional) sumar('Existe teléfono comercial publicado', 10);
  else porComprobar.push('Falta un canal comercial de contacto');

  if (perfil === 'web') {
    if (n.tipoWeb === 'ninguna') sumar('Google Maps no registra sitio web', 20);
    else if (n.tipoWeb === 'red_social' || n.tipoWeb === 'directorio') sumar('Solo figura una red social o directorio', 15);
    else {
      if (a?.pagespeed?.notas.performance != null && a.pagespeed.notas.performance < 50)
        sumar('Rendimiento móvil bajo medido por PageSpeed', 15);
      if (a?.gemini?.checklist?.adaptadaMovil.estado === 'no')
        sumar('Análisis indica problemas de adaptación móvil', 10);
    }
    porComprobar.push('Validar que no tiene otro sitio web y que existe interés en contratar');
  } else if (perfil === 'nixgofood') {
    // No confundir sitio web o botón de reserva con canal de pedidos propios.
    porComprobar.push('Comprobar sistema de pedidos, reparto, KDS y volumen operativo');
    porComprobar.push('Confirmar número de sucursales y tomador de decisiones');
    if (n.tipoWeb === 'propia' && a?.gemini?.checklist?.botonWhatsapp.estado === 'no')
      sumar('No se detecta botón de WhatsApp en su web', 5);
  } else if (perfil === 'nidocerca') {
    porComprobar.push('Confirmar si usa plataforma de comunicación con familias');
    porComprobar.push('Consultar aulas, número de representantes y dirección');
  } else if (perfil === 'whatsapp') {
    if (a?.gemini?.checklist?.botonWhatsapp.estado === 'si')
      sumar('Su web ya utiliza WhatsApp como canal de atención', 10);
    porComprobar.push('Medir consultas repetitivas y carga de atención humana');
  } else {
    if (a?.gemini?.checklist?.citaOnline.estado === 'no')
      sumar('No se detecta sistema de citas en su web', 15);
    porComprobar.push('Comprobar si actualmente gestiona citas en otro canal');
  }

  if (!a?.gemini) porComprobar.push('Pendiente análisis de su presencia digital');
  const puntos = motivos.reduce((s, m) => s + m.puntos, 0);
  return {
    puntuacion: Math.min(100, Math.max(0, puntos)),
    coincidencia,
    confianza: a?.gemini && coincidencia ? 'con-evidencia' : 'preliminar',
    motivos,
    porComprobar,
  };
}

export const ESTADOS_CONTACTO = ['contactado', 'respondio', 'reunion', 'cliente'] as const;
export function indicadoresFunnel(leads: { estado: string; contacto?: { verificacion: string } }[]) {
  const total = leads.length;
  const contactados = leads.filter((l) => ESTADOS_CONTACTO.includes(l.estado as typeof ESTADOS_CONTACTO[number])).length;
  const reuniones = leads.filter((l) => l.estado === 'reunion').length;
  const clientes = leads.filter((l) => l.estado === 'cliente').length;
  const correosVerificados = leads.filter((l) => l.contacto?.verificacion === 'valid').length;
  return {
    total, contactados, reuniones, clientes, correosVerificados,
    conversionSobreLeads: total ? Math.round(clientes * 1000 / total) / 10 : 0,
  };
}
