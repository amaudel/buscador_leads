import { describe, expect, it } from 'vitest';
import type { Analisis, Borradores, Lead } from '../shared/tipos';
import { enDias, progreso, siguientePaso } from '../src/logica/pasos';

const lead = (p: Partial<Lead> = {}): Lead => ({ negocioId: 'x', estado: 'nuevo', notas: '', proximaAccion: null, creado: '', actualizado: '', ...p });
const analisis = { negocioId: 'x', fecha: '', web: null, pagespeed: null, errores: [], gemini: { resumen: 'r' } } as unknown as Analisis;
const borradores = { negocioId: 'x' } as Borradores;
const contacto = { nombre: 'Ana Pérez', cargo: 'Dueño', email: null, verificacion: 'unknown' as const, proveedor: 'SRI', fecha: '', callId: null, costoUsd: 0 };

describe('siguientePaso', () => {
  it('sigue el proceso: guardar → analizar → dueño → mensajes → contactar', () => {
    expect(siguientePaso(undefined).accion).toBe('guardar');
    expect(siguientePaso(lead()).accion).toBe('analizar');
    expect(siguientePaso(lead({ estado: 'analizado' }), analisis).accion).toBe('dueno');
    expect(siguientePaso(lead({ contacto }), analisis).accion).toBe('mensajes');
    const s = siguientePaso(lead({ contacto }), analisis, borradores);
    expect(s.accion).toBe('contactar');
    expect(s.paso).toBe('seguimiento');
  });
  it('tras contactar, avisa del seguimiento según estado y fecha', () => {
    expect(siguientePaso(lead({ estado: 'contactado' })).corto).toBe('Esperando respuesta');
    expect(siguientePaso(lead({ estado: 'contactado', proximaAccion: '2000-01-01' })).corto).toBe('Seguimiento hoy');
    expect(siguientePaso(lead({ estado: 'respondio' })).corto).toBe('Agendar reunión');
    expect(siguientePaso(lead({ estado: 'cliente' })).accion).toBe('ninguna');
    expect(siguientePaso(lead({ estado: 'descartado' })).accion).toBe('ninguna');
  });
  it('calcula el progreso de cada paso', () => {
    expect(progreso(lead({ contacto, estado: 'reunion' }), analisis, borradores)).toEqual({ guardado: true, analizado: true, dueno: true, mensajes: true, contactado: true });
    expect(progreso()).toEqual({ guardado: false, analizado: false, dueno: false, mensajes: false, contactado: false });
  });
  it('enDias devuelve una fecha futura AAAA-MM-DD', () => {
    expect(enDias(3) > new Date().toISOString().slice(0, 10)).toBe(true);
    expect(enDias(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
