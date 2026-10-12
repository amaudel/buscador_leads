// Estado de la pantalla Buscar: se conserva al ir a una ficha y volver.
import { create } from 'zustand';
import type { CacheBusqueda } from '../datos';

export interface Filtros {
  soloSinWeb: boolean;
  soloConTelefono: boolean;
  valoracionMin: number;
  resenasMin: number;
  ocultarCerrados: boolean;
}

export type Orden = 'oportunidad' | 'google' | 'resenas' | 'valoracion';

interface EstadoBusqueda {
  nicho: string;
  zona: string;
  cache: CacheBusqueda | null;
  desdeCache: boolean;
  cargando: boolean;
  cargandoMas: boolean;
  error: string | null;
  filtros: Filtros;
  orden: Orden;
  vista: 'tabla' | 'tarjetas';
  seleccion: string[];
  set: (p: Partial<EstadoBusqueda>) => void;
  setFiltros: (p: Partial<Filtros>) => void;
  alternar: (id: string) => void;
}

export const useBusqueda = create<EstadoBusqueda>((set) => ({
  nicho: '',
  zona: '',
  cache: null,
  desdeCache: false,
  cargando: false,
  cargandoMas: false,
  error: null,
  filtros: { soloSinWeb: false, soloConTelefono: false, valoracionMin: 0, resenasMin: 0, ocultarCerrados: true },
  orden: 'oportunidad',
  vista: 'tabla',
  seleccion: [],
  set: (p) => set(p),
  setFiltros: (p) => set((s) => ({ filtros: { ...s.filtros, ...p } })),
  alternar: (id) =>
    set((s) => ({ seleccion: s.seleccion.includes(id) ? s.seleccion.filter((x) => x !== id) : [...s.seleccion, id] })),
}));
