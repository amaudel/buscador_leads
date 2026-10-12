// Cola global de análisis: como máximo dos webs a la vez, con progreso.
import { create } from 'zustand';
import type { Analisis, Negocio } from '../../shared/tipos';
import { api, mensajeError, type GeminiConMeta } from '../api/cliente';
import { repo } from '../datos';
import { asegurarLead, actualizarLead } from '../logica/leads';

export type Fase = 'en_cola' | 'pagespeed' | 'gemini' | 'hecho' | 'error';
export interface ItemCola {
  id: string;
  nombre: string;
  fase: Fase;
  error?: string;
}

const CONCURRENCIA = 2;

interface EstadoCola {
  items: Record<string, ItemCola>;
  orden: string[];
  analizar: (negocios: Negocio[]) => void;
  limpiar: () => void;
}

let enCurso = 0;
const pendientes: Negocio[] = [];

export const useCola = create<EstadoCola>((set, get) => {
  const fase = (id: string, f: Fase, error?: string) =>
    set((s) => ({ items: { ...s.items, [id]: { ...s.items[id], fase: f, error } } }));

  const bombear = () => {
    while (enCurso < CONCURRENCIA && pendientes.length) {
      const n = pendientes.shift()!;
      enCurso++;
      analizarNegocio(n, (f) => fase(n.id, f))
        .then(() => fase(n.id, 'hecho'))
        .catch((e) => fase(n.id, 'error', mensajeError(e)))
        .finally(() => {
          enCurso--;
          bombear();
        });
    }
  };

  return {
    items: {},
    orden: [],
    analizar: (negocios) => {
      const activos = get().items;
      const nuevos = negocios.filter((n) => !['en_cola', 'pagespeed', 'gemini'].includes(activos[n.id]?.fase ?? ''));
      if (!nuevos.length) return;
      set((s) => ({
        items: { ...s.items, ...Object.fromEntries(nuevos.map((n) => [n.id, { id: n.id, nombre: n.nombre, fase: 'en_cola' as Fase }])) },
        orden: [...s.orden.filter((id) => !nuevos.some((n) => n.id === id)), ...nuevos.map((n) => n.id)],
      }));
      pendientes.push(...nuevos);
      bombear();
    },
    limpiar: () =>
      set((s) => {
        const vivos = s.orden.filter((id) => !['hecho', 'error'].includes(s.items[id].fase));
        return { orden: vivos, items: Object.fromEntries(vivos.map((id) => [id, s.items[id]])) };
      }),
  };
});

/** Corrige el punto HTTPS con datos objetivos cuando los hay. */
function ajustarHttps(g: GeminiConMeta, web: string, urlFinal?: string) {
  if (!g.checklist) return g;
  const url = urlFinal || web;
  const https = /^https:/i.test(url);
  return {
    ...g,
    checklist: {
      ...g.checklist,
      https: { estado: https ? ('si' as const) : ('no' as const), detalle: https ? `Carga con HTTPS (${url})` : `La web carga sin HTTPS (${url})` },
    },
  };
}

export async function analizarNegocio(n: Negocio, alCambiarFase: (f: Fase) => void): Promise<Analisis> {
  const errores: string[] = [];
  let pagespeed: Analisis['pagespeed'] = null;
  let gemini: Analisis['gemini'] = null;

  if (n.tipoWeb === 'propia' && n.web) {
    alCambiarFase('pagespeed');
    try {
      pagespeed = await api.pagespeed(n.web);
    } catch (e) {
      errores.push(mensajeError(e));
    }
    alCambiarFase('gemini');
    try {
      gemini = ajustarHttps(await api.analizarWeb(n, pagespeed), n.web, pagespeed?.urlFinal);
    } catch (e) {
      errores.push(mensajeError(e));
    }
  } else {
    alCambiarFase('gemini');
    try {
      gemini = await api.analizarSinWeb(n, n.tipoWeb);
    } catch (e) {
      errores.push(mensajeError(e));
    }
  }
  if (!pagespeed && !gemini) throw new Error(errores.join(' · '));

  const a: Analisis = { negocioId: n.id, fecha: new Date().toISOString(), web: n.web, pagespeed, gemini, errores };
  await repo.guardarAnalisis(a);
  const lead = await asegurarLead(n.id, 'analizado');
  if (lead.estado === 'nuevo') await actualizarLead(n.id, { estado: 'analizado' });
  return a;
}
