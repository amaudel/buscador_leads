import type { Negocio, NegocioPlaces } from '../../shared/tipos';
import { api } from '../api/cliente';
import { repo, type CacheBusqueda } from '../datos';
import { clasificarWeb } from './clasificarWeb';
import { claveBusqueda } from './texto';

export const MAX_PAGINAS = 3;
const CADUCIDAD_MS = 7 * 24 * 3600_000;

export const consultaTexto = (nicho: string, zona: string) => `${nicho.trim()} en ${zona.trim()}`;

export function aNegocio(p: NegocioPlaces, nicho: string, zona: string): Negocio {
  return { ...p, tipoWeb: clasificarWeb(p.web), nicho: nicho.trim(), zona: zona.trim(), vistoEn: new Date().toISOString() };
}

export function negociosDeCache(c: CacheBusqueda): Negocio[] {
  const vistos = new Set<string>();
  const r: Negocio[] = [];
  for (const p of c.paginas.flat()) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    r.push(aNegocio(p, c.nicho, c.zona));
  }
  return r;
}

export async function cacheVigente(nicho: string, zona: string, region: string): Promise<CacheBusqueda | null> {
  const c = await repo.obtenerBusqueda(claveBusqueda(nicho, zona, region));
  return c && Date.now() - new Date(c.fecha).getTime() < CADUCIDAD_MS ? c : null;
}

async function guardar(c: CacheBusqueda, nuevos: NegocioPlaces[]) {
  await repo.guardarBusqueda(c);
  // Se actualizan los datos de Places pero se conserva el nicho/zona de la primera vez que se vio.
  const previos = new Map((await repo.listarNegocios(nuevos.map((n) => n.id))).map((n) => [n.id, n]));
  await repo.guardarNegocios(
    nuevos.map((n) => {
      const previo = previos.get(n.id);
      const nuevo = aNegocio(n, c.nicho, c.zona);
      return previo ? { ...nuevo, nicho: previo.nicho, zona: previo.zona, vistoEn: previo.vistoEn } : nuevo;
    }),
  );
}

/** Primera página: usa la caché salvo que se fuerce. */
export async function buscar(nicho: string, zona: string, region: string, forzar = false) {
  if (!forzar) {
    const c = await cacheVigente(nicho, zona, region);
    if (c) return { cache: c, desdeCache: true };
  }
  const r = await api.buscar(consultaTexto(nicho, zona), region);
  const c: CacheBusqueda = {
    clave: claveBusqueda(nicho, zona, region),
    nicho: nicho.trim(),
    zona: zona.trim(),
    region,
    fecha: new Date().toISOString(),
    paginas: [r.negocios],
    nextPageToken: r.nextPageToken,
  };
  await guardar(c, r.negocios);
  return { cache: c, desdeCache: false };
}

export async function cargarMas(c: CacheBusqueda): Promise<CacheBusqueda> {
  if (!c.nextPageToken || c.paginas.length >= MAX_PAGINAS) return c;
  const r = await api.buscar(consultaTexto(c.nicho, c.zona), c.region, c.nextPageToken);
  const nueva: CacheBusqueda = {
    ...c,
    paginas: [...c.paginas, r.negocios],
    nextPageToken: c.paginas.length + 1 >= MAX_PAGINAS ? null : r.nextPageToken,
  };
  await guardar(nueva, r.negocios);
  return nueva;
}
