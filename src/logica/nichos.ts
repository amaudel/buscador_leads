import type { MetricaNicho, Negocio } from '../../shared/tipos';

export function calcularMetrica(categoria: string, negocios: Negocio[]): MetricaNicho {
  const activos = negocios.filter((n) => !n.estadoNegocio || n.estadoNegocio === 'OPERATIONAL');
  const total = activos.length;
  const conValoracion = activos.filter((n) => n.valoracion != null);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    categoria,
    total,
    pctSinWeb: total ? Math.round((activos.filter((n) => n.tipoWeb !== 'propia').length / total) * 100) : 0,
    mediaValoracion: conValoracion.length ? r1(conValoracion.reduce((s, n) => s + (n.valoracion ?? 0), 0) / conValoracion.length) : null,
    mediaResenas: total ? Math.round(activos.reduce((s, n) => s + n.numResenas, 0) / total) : 0,
  };
}
