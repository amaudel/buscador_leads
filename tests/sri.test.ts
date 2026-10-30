import { afterEach, describe, expect, it } from 'vitest';
import { cantonDeDireccion, consultaFts, nombrePropio, terminos } from '../shared/sri';
import { buscarSri } from '../worker/sri';
import type { Env } from '../worker';

describe('SRI: normalización', () => {
  it('quita palabras vacías, tildes y duplicados', () => {
    expect(terminos('Centro Psicopedagógico Lo Mágico de Aprender')).toEqual(['psicopedagogico', 'lo', 'magico', 'aprender']);
    expect(terminos('Clínica Dental Sonrisa Cía. Ltda. - Cuenca')).toEqual(['clinica', 'dental', 'sonrisa']);
  });
  it('arma la consulta FTS con prefijos', () => {
    expect(consultaFts(['magico', 'aprender'])).toBe('"magico"* AND "aprender"*');
    expect(consultaFts(['a', 'b'], 'alguno')).toBe('"a"* OR "b"*');
    expect(consultaFts([])).toBeNull();
  });
  it('pasa la razón social a nombre propio', () => {
    expect(nombrePropio('LOPEZ SALAMEA JENNIFER ALEXIS')).toBe('Jennifer Alexis Lopez Salamea');
    expect(nombrePropio('ORDONEZ CARLOS LAUTARO')).toBe('Lautaro Ordonez Carlos');
  });
  it('saca el cantón de la dirección de Google Maps', () => {
    expect(cantonDeDireccion('Av. Huayna Cápac 101, Cuenca 010150, Ecuador')).toBe('CUENCA');
    expect(cantonDeDireccion('Gualaceo, Ecuador')).toBe('GUALACEO');
    expect(cantonDeDireccion(null)).toBeNull();
  });
});

// D1 simulado: registra consultas y devuelve filas según el cantón.
function d1(filasPor: (q: string, canton: string | null) => unknown[]) {
  const llamadas: [string, string | null][] = [];
  const db = {
    prepare: () => ({
      bind: (q: string, canton: string | null) => ({
        all: async () => {
          llamadas.push([q, canton]);
          return { results: filasPor(q, canton) };
        },
      }),
    }),
  };
  return { db: db as unknown as D1Database, llamadas };
}
const req = (cuerpo: unknown) => new Request('https://radar.test/api/sri/buscar', { method: 'POST', body: JSON.stringify(cuerpo) });
const env = (db?: D1Database): Env => ({ ASSETS: {} as Fetcher, SRI_DB: db });
const fila = { ruc: '0104036371001', nombre_comercial: 'CENTRO PSICOPEDAGOGICO LO MAGICO DE APRENDER', razon_social: 'LOPEZ SALAMEA JENNIFER ALEXIS', tipo: 'PERSONA NATURAL', canton: 'CUENCA', parroquia: 'YANUNCAY', actividad: 'EDUCACIÓN INICIAL' };

describe('SRI: endpoint', () => {
  afterEach(() => undefined);
  it('error claro si la base no está enlazada', async () => {
    await expect(buscarSri(req({ nombre: 'x y' }), env())).rejects.toThrow(/no están cargados/);
  });
  it('devuelve candidatos y marca el dueño probable de persona natural', async () => {
    const { db, llamadas } = d1(() => [fila, { ...fila, ruc: '0190000000001', tipo: 'SOCIEDAD', razon_social: 'MAGICO CIA LTDA' }]);
    const r = await buscarSri(req({ nombre: 'Lo Mágico de Aprender', canton: 'Cuenca' }), env(db));
    expect(llamadas[0]).toEqual(['"lo"* AND "magico"* AND "aprender"*', 'CUENCA']);
    expect(r.candidatos[0].duenoProbable).toBe('LOPEZ SALAMEA JENNIFER ALEXIS');
    expect(r.candidatos[1].duenoProbable).toBeNull();
  });
  it('si no encuentra en el cantón, amplía a toda la provincia y luego a cualquier término', async () => {
    const { db, llamadas } = d1(() => []);
    await buscarSri(req({ nombre: 'Taller Andino', canton: 'Cuenca' }), env(db));
    expect(llamadas).toEqual([
      ['"taller"* AND "andino"*', 'CUENCA'],
      ['"taller"* AND "andino"*', null],
      ['"taller"* OR "andino"*', 'CUENCA'],
    ]);
  });
  it('rechaza nombre vacío', async () => {
    const { db } = d1(() => []);
    await expect(buscarSri(req({ nombre: 'de la' }), env(db))).rejects.toThrow(/nombre del negocio/);
  });
});
