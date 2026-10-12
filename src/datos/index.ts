import { RepositorioIndexedDB } from './indexeddb';
import type { Repositorio } from './repositorio';

export const repo: Repositorio = new RepositorioIndexedDB();
export { cambios } from './repositorio';
export type { CacheBusqueda } from './repositorio';
