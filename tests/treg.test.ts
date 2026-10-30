import { afterEach, describe, expect, it, vi } from 'vitest';
import { tregCorreo, tregPersonas, extraerPersonas, type PersonaEncontrada } from '../worker/treg';
import type { Env } from '../worker';

const env = (override: Partial<Env> = {}): Env => ({ ASSETS: {} as Fetcher, TREG_ENABLED: 'true', TREG_TOKEN: 'secreto-treg', TREG_ACCESS_KEY: 'clave-admin', ...override });
const req = (payload: unknown, key = 'clave-admin') => new Request('https://radar.test/api/treg/correo', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-leads-admin-key': key },
  body: JSON.stringify(payload),
});
afterEach(() => vi.unstubAllGlobals());
describe('Integración Treg fail-closed', () => {
  it('bloquea funciones de pago sin activar explícitamente Treg', async () => {
    await expect(tregCorreo(req({ domain: 'ejemplo.com', fullName: 'Ana Pérez' }), env({ TREG_ENABLED: undefined }))).rejects.toThrow(/desactivado/);
  });
  it('rechaza clave administrativa incorrecta y no invoca al proveedor', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(tregCorreo(req({ domain: 'ejemplo.com', fullName: 'Ana Pérez' }, 'mala'), env())).rejects.toThrow(/incorrecta/);
    expect(f).not.toHaveBeenCalled();
  });
  it('rechaza dominios sociales, evitando búsquedas equívocas', async () => {
    await expect(tregPersonas(req({ domain: 'facebook.com', cargo: 'owner' }), env())).rejects.toThrow(/dominio propio/);
  });
  it('limita el precio y mantiene el token fuera de la respuesta', async () => {
    const f = vi.fn(async (_url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      expect(headers['x-treg-route-max-cost']).toBe('0.15');
      expect(headers['x-treg-token']).toBe('secreto-treg');
      expect(headers['x-treg-route-verify']).toBe('true');
      return new Response(JSON.stringify({ output: { email: 'ana@ejemplo.com' }, _treg: { verification: { verdict: 'valid' } } }), {
        status: 200, headers: { 'x-treg-cost-micro': '2500', 'x-treg-call-id': 'call-1', 'x-treg-served-by': 'proveedor-prueba' },
      });
    });
    vi.stubGlobal('fetch', f);
    const r = await tregCorreo(req({ domain: 'ejemplo.com', fullName: 'Ana Pérez' }), env());
    expect(r.contacto.email).toBe('ana@ejemplo.com');
    expect(r.contacto.verificacion).toBe('valid');
    expect(r.costoUsd).toBe(0.0025);
    expect(JSON.stringify(r)).not.toContain('secreto-treg');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('no presenta direcciones de perfiles como verificadas', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ output: { people: [{ full_name: 'Ana Pérez', email: 'ana@empresa.com' }] } })));
    const r = await tregPersonas(req({ domain: 'empresa.com', cargo: 'owner' }), env());
    expect(r.personas[0].email).toBeNull();
    expect(r.personas[0].verificacion).toBe('unknown');
  });
  it('extrae resultados y descarta registros vacíos', () => {
    const p: PersonaEncontrada[] = extraerPersonas({ output: { people: [{ full_name: 'Ana Pérez', title: 'CEO' }, {}] } });
    expect(p).toHaveLength(1);
    expect(p[0].cargo).toBe('CEO');
  });
});

describe('Treg: petición mal formada', () => {
  it('responde 400 si el cuerpo no es JSON', async () => {
    const malo = new Request('https://radar.test/api/treg/correo', { method: 'POST', headers: { 'x-leads-admin-key': 'clave-admin' }, body: '{no' });
    await expect(tregCorreo(malo, env())).rejects.toThrow(/JSON válido/);
  });
});

describe('Treg: campos según el catálogo', () => {
  it('people.search envía company_domain, title y limit', async () => {
    const f = vi.fn(async (_url: string, _o: RequestInit) => new Response(JSON.stringify({ output: { people: [] } })));
    vi.stubGlobal('fetch', f);
    await tregPersonas(req({ domain: 'https://www.empresa.com.ec/contacto', cargo: 'owner' }), env());
    const [url, o] = f.mock.calls[0];
    expect(url).toBe('https://treg.to/call/treg.people.search');
    expect(JSON.parse(o.body as string)).toEqual({ company_domain: 'empresa.com.ec', title: 'owner', limit: 5 });
  });
});
