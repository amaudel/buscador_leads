import { describe, expect, it } from 'vitest';
import type { Analisis, Negocio } from '../shared/tipos';
import { clasificarWeb } from '../src/logica/clasificarWeb';
import { enCola } from '../src/logica/cola';
import { aCsv } from '../src/logica/csv';
import { calcularMetrica } from '../src/logica/nichos';
import { puntuar } from '../src/logica/puntuacion';
import { claveBusqueda } from '../src/logica/texto';

const negocio = (p: Partial<Negocio> = {}): Negocio => ({
  id: 'x', nombre: 'Taller Pérez', dedicacion: 'Taller mecánico', tipos: [], direccion: 'Calle 1', ubicacion: null,
  telNacional: '07 123 4567', telInternacional: '+593 7 123 4567', web: null, valoracion: 4.6, numResenas: 80,
  mapsUrl: null, estadoNegocio: 'OPERATIONAL', tipoWeb: 'ninguna', nicho: 'talleres', zona: 'Cuenca', vistoEn: '', ...p,
});

describe('clasificarWeb', () => {
  it.each([
    [null, 'ninguna'],
    ['', 'ninguna'],
    ['https://www.facebook.com/tallerperez', 'red_social'],
    ['http://instagram.com/x', 'red_social'],
    ['https://linktr.ee/peluqueria', 'red_social'],
    ['https://wa.me/593999', 'red_social'],
    ['https://www.doctoralia.com.ec/dr-x', 'directorio'],
    ['https://tallerperez.business.site/', 'directorio'],
    ['https://www.paginasamarillas.es/f/x', 'directorio'],
    ['https://www.tripadvisor.es/Restaurant', 'directorio'],
    ['https://tallerperez.com', 'propia'],
    ['https://clinicadental.wixsite.com/inicio', 'propia'],
    ['https://notfacebook.com', 'propia'],
  ])('%s → %s', (url, esperado) => {
    expect(clasificarWeb(url)).toBe(esperado);
  });
});

describe('puntuar', () => {
  it('sin web y activo puntúa alto, con desglose y etiqueta', () => {
    const p = puntuar(negocio());
    expect(p.total).toBe(30 + 35 + 15 + 10 + 5);
    expect(p.provisional).toBe(true);
    expect(p.etiqueta).toBe('Sin web');
    expect(p.desglose.map((d) => d.motivo)).toContain('No tiene página web');
  });

  it('negocio cerrado = 0', () => {
    expect(puntuar(negocio({ estadoNegocio: 'CLOSED_PERMANENTLY' })).total).toBe(0);
  });

  it('poca actividad baja la nota', () => {
    const p = puntuar(negocio({ numResenas: 2, valoracion: null, telNacional: null, telInternacional: null }));
    expect(p.total).toBe(30 + 35 - 15 - 5);
  });

  it('web buena baja y web mala sube tras el análisis', () => {
    const n = negocio({ tipoWeb: 'propia', web: 'https://x.com.ec' });
    const base = puntuar(n);
    expect(base.provisional).toBe(true);
    const check = (estado: 'si' | 'no') => ({ estado, detalle: '' });
    const analisis = (perf: number, estado: 'si' | 'no'): Analisis => ({
      negocioId: 'x', fecha: '', web: n.web, errores: [],
      pagespeed: { urlFinal: '', captura: null, auditorias: [], notas: { performance: perf, seo: 95, accessibility: 95, bestPractices: 90 } },
      gemini: {
        resumen: '', correos: [], redes: [], problemas: [], servicio: { tipo: 'mejora_web', porque: '' }, modelo: '', modo: '', avisos: [],
        checklist: { https: check(estado), adaptadaMovil: check(estado), botonWhatsapp: check(estado), citaOnline: check(estado), formularioContacto: check(estado), desactualizada: check(estado === 'si' ? 'no' : 'si') },
      },
    });
    const buena = puntuar(n, analisis(97, 'si'));
    const mala = puntuar(n, analisis(30, 'no'));
    expect(buena.provisional).toBe(false);
    expect(buena.total).toBeLessThan(base.total);
    expect(mala.total).toBeGreaterThan(base.total);
    expect(mala.total).toBeLessThanOrEqual(100);
  });
});

describe('enCola', () => {
  it('nunca ejecuta más de 2 a la vez y sigue tras un error', async () => {
    let activos = 0;
    let maximo = 0;
    const hechos: number[] = [];
    await enCola([1, 2, 3, 4, 5], async (x) => {
      activos++;
      maximo = Math.max(maximo, activos);
      await new Promise((r) => setTimeout(r, 5));
      activos--;
      if (x === 2) throw new Error('falla');
      hechos.push(x);
    });
    expect(maximo).toBe(2);
    expect(hechos.sort()).toEqual([1, 3, 4, 5]);
  });
});

describe('csv y claves', () => {
  it('escapa comillas, separadores y saltos', () => {
    expect(aCsv([{ a: 'x;y', b: 'di "hola"', c: 'l1\nl2', d: 3 }])).toBe('a;b;c;d\r\n"x;y";"di ""hola""";"l1\nl2";3');
  });
  it('normaliza la clave de caché', () => {
    expect(claveBusqueda('  Clínicas  Dentales ', 'CUENCA, Ecuador', 'ec')).toBe('clinicas dentales|cuenca, ecuador|EC');
  });
  it('calcula métricas de nicho ignorando cerrados', () => {
    const m = calcularMetrica('talleres', [
      negocio({ id: '1' }),
      negocio({ id: '2', tipoWeb: 'propia', valoracion: 4, numResenas: 20 }),
      negocio({ id: '3', estadoNegocio: 'CLOSED_PERMANENTLY' }),
    ]);
    expect(m).toEqual({ categoria: 'talleres', total: 2, pctSinWeb: 50, mediaValoracion: 4.3, mediaResenas: 50 });
  });
});

describe('exportar', () => {
  it('genera cabecera y una fila por negocio con todos los datos', async () => {
    const { tablaExportable, nombreArchivo } = await import('../src/logica/exportar');
    const t = tablaExportable([{ n: negocio({ web: 'https://facebook.com/x', tipoWeb: 'red_social' }) }]);
    expect(t).toHaveLength(2);
    const fila = Object.fromEntries((t[0] as string[]).map((c, i) => [c, t[1][i]]));
    expect(fila).toMatchObject({
      Nombre: 'Taller Pérez', Teléfono: '07 123 4567', 'Tipo de web': 'Sin web propia', Reseñas: 80,
      WhatsApp: 'https://wa.me/59371234567', 'Estado del lead': 'No guardado', Oportunidad: 90,
    });
    expect(nombreArchivo('Clínicas dentales', 'Cuenca, Ecuador', 'xlsx')).toMatch(/^negocios-clinicas-dentales-cuenca-ecuador-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
