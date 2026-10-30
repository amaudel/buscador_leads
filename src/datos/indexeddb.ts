import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Analisis, Borradores, Lead, Negocio, RadarNichos } from '../../shared/tipos';
import { cambios, type CacheBusqueda, type Repositorio } from './repositorio';

interface Esquema extends DBSchema {
  negocios: { key: string; value: Negocio };
  leads: { key: string; value: Lead };
  analisis: { key: string; value: Analisis };
  borradores: { key: string; value: Borradores };
  busquedas: { key: string; value: CacheBusqueda };
  radares: { key: string; value: RadarNichos };
}

const ALMACENES = ['negocios', 'leads', 'analisis', 'borradores', 'busquedas', 'radares'] as const;

export class RepositorioIndexedDB implements Repositorio {
  private db: Promise<IDBPDatabase<Esquema>>;

  constructor(nombre = 'radar-de-clientes') {
    this.db = openDB<Esquema>(nombre, 1, {
      upgrade(db) {
        db.createObjectStore('negocios', { keyPath: 'id' });
        db.createObjectStore('leads', { keyPath: 'negocioId' });
        db.createObjectStore('analisis', { keyPath: 'negocioId' });
        db.createObjectStore('borradores', { keyPath: 'negocioId' });
        db.createObjectStore('busquedas', { keyPath: 'clave' });
        db.createObjectStore('radares', { keyPath: 'clave' });
      },
    });
  }

  async guardarNegocios(lista: Negocio[]) {
    const tx = (await this.db).transaction('negocios', 'readwrite');
    await Promise.all([...lista.map((n) => tx.store.put(n)), tx.done]);
    cambios.avisar();
  }
  async obtenerNegocio(id: string) {
    return (await this.db).get('negocios', id);
  }
  async listarNegocios(ids?: string[]) {
    const db = await this.db;
    if (!ids) return db.getAll('negocios');
    const r = await Promise.all(ids.map((id) => db.get('negocios', id)));
    return r.filter((n): n is Negocio => Boolean(n));
  }

  async obtenerLead(id: string) {
    return (await this.db).get('leads', id);
  }
  async listarLeads() {
    return (await this.db).getAll('leads');
  }
  async guardarLead(l: Lead) {
    await (await this.db).put('leads', l);
    cambios.avisar();
  }
  async eliminarLead(id: string) {
    await (await this.db).delete('leads', id);
    cambios.avisar();
  }

  async obtenerAnalisis(id: string) {
    return (await this.db).get('analisis', id);
  }
  async listarAnalisis() {
    return (await this.db).getAll('analisis');
  }
  async guardarAnalisis(a: Analisis) {
    await (await this.db).put('analisis', a);
    cambios.avisar();
  }

  async obtenerBorradores(id: string) {
    return (await this.db).get('borradores', id);
  }
  async listarBorradores() {
    return (await this.db).getAll('borradores');
  }
  async guardarBorradores(b: Borradores) {
    await (await this.db).put('borradores', b);
    cambios.avisar();
  }

  async obtenerBusqueda(clave: string) {
    return (await this.db).get('busquedas', clave);
  }
  async guardarBusqueda(c: CacheBusqueda) {
    await (await this.db).put('busquedas', c);
  }

  async obtenerRadar(clave: string) {
    return (await this.db).get('radares', clave);
  }
  async listarRadares() {
    return (await this.db).getAll('radares');
  }
  async guardarRadar(r: RadarNichos) {
    await (await this.db).put('radares', r);
    cambios.avisar();
  }

  async borrarTodo() {
    const db = await this.db;
    await Promise.all(ALMACENES.map((a) => db.clear(a)));
    cambios.avisar();
  }
}
