import { describe, expect, it } from 'vitest';
import { evaluarICP, indicadoresFunnel } from '../src/logica/icp';
import type { Negocio } from '../shared/tipos';

const restaurante: Negocio = {
  id: 'abc', nombre: 'Restaurante Prueba', dedicacion: 'Restaurante', tipos: ['restaurant'],
  direccion: 'Cuenca', ubicacion: null, telNacional: '072222222', telInternacional: null,
  web: null, valoracion: 4.5, numResenas: 80, mapsUrl: null, estadoNegocio: 'OPERATIONAL',
  tipoWeb: 'ninguna', nicho: 'restaurantes', zona: 'Cuenca, Ecuador', vistoEn: '',
};
describe('ICP segmentado', () => {
  it('prioriza un restaurante para NixgoFood, pero no afirma que necesita el sistema', () => {
    const p = evaluarICP(restaurante, null, 'nixgofood');
    expect(p.coincidencia).toBe(true);
    expect(p.puntuacion).toBe(65);
    expect(p.confianza).toBe('preliminar');
    expect(p.porComprobar.some((x) => x.includes('pedidos'))).toBe(true);
  });
  it('no califica el restaurante como centro infantil', () => {
    const p = evaluarICP(restaurante, null, 'nidocerca');
    expect(p.coincidencia).toBe(false);
    expect(p.puntuacion).toBeLessThan(40);
  });
  it('no considera la falta de web como prueba de necesidad de NixgoFood', () => {
    const conWeb = evaluarICP({ ...restaurante, tipoWeb: 'propia', web: 'https://restaurante.com' }, null, 'nixgofood');
    expect(evaluarICP(restaurante, null, 'nixgofood').puntuacion).toBe(conWeb.puntuacion);
  });
  it('distingue negocio cerrado y no atribuye oportunidad', () => {
    expect(evaluarICP({ ...restaurante, estadoNegocio: 'CLOSED_PERMANENTLY' }, null, 'web').puntuacion).toBe(0);
  });
  it('calcula conversion sobre leads guardados, no sobre consultas a Places', () => {
    const m = indicadoresFunnel([{ estado: 'contactado' }, { estado: 'reunion' }, { estado: 'cliente', contacto: { verificacion: 'valid' } }]);
    expect(m).toEqual({ total: 3, contactados: 3, reuniones: 1, clientes: 1, correosVerificados: 1, conversionSobreLeads: 33.3 });
  });
});
