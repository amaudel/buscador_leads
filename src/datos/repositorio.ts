// Capa de datos: la app solo habla con esta interfaz. Hoy se implementa con
// IndexedDB; para pasar a Firebase (o D1) basta con otra implementación.
import type { Analisis, Borradores, Lead, Negocio, RadarNichos, NegocioPlaces } from '../../shared/tipos';

export interface CacheBusqueda {
  clave: string;
  nicho: string;
  zona: string;
  region: string;
  fecha: string;
  paginas: NegocioPlaces[][];
  nextPageToken: string | null;
}

export interface Repositorio {
  guardarNegocios(n: Negocio[]): Promise<void>;
  obtenerNegocio(id: string): Promise<Negocio | undefined>;
  listarNegocios(ids?: string[]): Promise<Negocio[]>;

  obtenerLead(id: string): Promise<Lead | undefined>;
  listarLeads(): Promise<Lead[]>;
  guardarLead(l: Lead): Promise<void>;
  eliminarLead(id: string): Promise<void>;

  obtenerAnalisis(id: string): Promise<Analisis | undefined>;
  listarAnalisis(): Promise<Analisis[]>;
  guardarAnalisis(a: Analisis): Promise<void>;

  obtenerBorradores(id: string): Promise<Borradores | undefined>;
  guardarBorradores(b: Borradores): Promise<void>;

  obtenerBusqueda(clave: string): Promise<CacheBusqueda | undefined>;
  guardarBusqueda(c: CacheBusqueda): Promise<void>;

  obtenerRadar(clave: string): Promise<RadarNichos | undefined>;
  listarRadares(): Promise<RadarNichos[]>;
  guardarRadar(r: RadarNichos): Promise<void>;

  borrarTodo(): Promise<void>;
}

// Aviso de cambios para que las pantallas se refresquen.
type Oyente = () => void;
const oyentes = new Set<Oyente>();
export const cambios = {
  suscribir(f: Oyente) {
    oyentes.add(f);
    return () => oyentes.delete(f);
  },
  avisar() {
    oyentes.forEach((f) => f());
  },
};
