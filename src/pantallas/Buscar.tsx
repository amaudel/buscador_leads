import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mensajeError } from '../api/cliente';
import { TablaNegocios, TarjetasNegocios, type FilaNegocio } from '../componentes/Negocios';
import { Cargando, ErrorCaja, Icono, Vacio } from '../componentes/ui';
import { avisar } from '../componentes/Toast';
import { repo } from '../datos';
import { useAjustes, usoDelMes } from '../datos/ajustes';
import { useCola } from '../estado/analisis';
import { useBusqueda, type Orden } from '../estado/busqueda';
import { useDatos } from '../estado/useDatos';
import { MAX_PAGINAS, buscar, cargarMas, negociosDeCache } from '../logica/busqueda';
import { guardarVarios } from '../logica/leads';
import { puntuar } from '../logica/puntuacion';
import { NICHOS_SUGERIDOS, fechaCorta } from '../logica/texto';

function useEsMovil() {
  const q = '(max-width: 860px)';
  const [movil, setMovil] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setMovil(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return movil;
}

/** Pide confirmación si ya se alcanzó el límite mensual de Places. */
export function confirmarGasto(llamadas: number): boolean {
  const a = useAjustes.getState();
  const uso = usoDelMes(a);
  if (uso + llamadas <= a.limiteMensual) return true;
  return window.confirm(
    `Esta acción gasta ${llamadas} llamada(s) a Places y ya llevas ${uso} de ${a.limiteMensual} este mes. ¿Continuar de todos modos?`,
  );
}

export function Buscar() {
  const s = useBusqueda();
  const region = useAjustes((a) => a.regionCode);
  const analizar = useCola((c) => c.analizar);
  const movil = useEsMovil();
  const [params, setParams] = useSearchParams();
  const [aviso, setAviso] = useState<string | null>(null);

  const { datos: extra } = useDatos(async () => {
    const [leads, analisis] = await Promise.all([repo.listarLeads(), repo.listarAnalisis()]);
    return { leads: new Map(leads.map((l) => [l.negocioId, l])), analisis: new Map(analisis.map((a) => [a.negocioId, a])) };
  }, []);

  const ejecutar = async (nicho: string, zona: string, forzar = false) => {
    if (!nicho.trim() || !zona.trim()) return;
    s.set({ cargando: true, error: null, seleccion: [], nicho, zona });
    setAviso(null);
    try {
      if (forzar && !confirmarGasto(1)) return s.set({ cargando: false });
      const r = await buscar(nicho, zona, region, forzar);
      s.set({ cache: r.cache, desdeCache: r.desdeCache, cargando: false });
    } catch (e) {
      s.set({ cargando: false, error: mensajeError(e) });
    }
  };

  // Búsqueda lanzada desde el Radar de nichos (?nicho=&zona=)
  useEffect(() => {
    const nicho = params.get('nicho');
    const zona = params.get('zona');
    if (nicho && zona) {
      setParams({}, { replace: true });
      ejecutar(nicho, zona);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const masResultados = async () => {
    if (!s.cache || !confirmarGasto(1)) return;
    s.set({ cargandoMas: true, error: null });
    try {
      s.set({ cache: await cargarMas(s.cache), cargandoMas: false });
    } catch (e) {
      s.set({ cargandoMas: false, error: mensajeError(e) });
    }
  };

  const todas: FilaNegocio[] = useMemo(() => {
    if (!s.cache) return [];
    return negociosDeCache(s.cache).map((n) => ({ n, lead: extra?.leads.get(n.id), analisis: extra?.analisis.get(n.id) }));
  }, [s.cache, extra]);

  const filas = useMemo(() => {
    const f = s.filtros;
    const r = todas.filter(({ n }) => {
      if (f.soloSinWeb && n.tipoWeb === 'propia') return false;
      if (f.soloConTelefono && !n.telNacional && !n.telInternacional) return false;
      if (f.valoracionMin > 0 && (n.valoracion ?? 0) < f.valoracionMin) return false;
      if (f.resenasMin > 0 && n.numResenas < f.resenasMin) return false;
      if (f.ocultarCerrados && n.estadoNegocio && n.estadoNegocio !== 'OPERATIONAL') return false;
      return true;
    });
    if (s.orden === 'oportunidad') r.sort((a, b) => puntuar(b.n, b.analisis).total - puntuar(a.n, a.analisis).total);
    if (s.orden === 'resenas') r.sort((a, b) => b.n.numResenas - a.n.numResenas);
    if (s.orden === 'valoracion') r.sort((a, b) => (b.n.valoracion ?? 0) - (a.n.valoracion ?? 0));
    return r;
  }, [todas, s.filtros, s.orden]);

  const vista = movil ? 'tarjetas' : s.vista;
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const exportar = async (formato: 'excel' | 'pdf') => {
    if (!s.cache) return;
    setExportando(formato);
    try {
      const { exportarExcel, exportarPdf } = await import('../logica/exportar');
      await (formato === 'excel' ? exportarExcel : exportarPdf)(filas, s.cache.nicho, s.cache.zona);
    } catch (e) {
      s.set({ error: `No se pudo exportar: ${mensajeError(e)}` });
    } finally {
      setExportando(null);
    }
  };
  const seleccionados = todas.filter((f) => s.seleccion.includes(f.n.id)).map((f) => f.n);
  const sinWeb = todas.filter((f) => f.n.tipoWeb !== 'propia').length;
  const conTelefono = todas.filter((f) => f.n.telNacional || f.n.telInternacional).length;
  const conValoracion = todas.filter((f) => f.n.valoracion != null);
  const mediaValoracion = conValoracion.length
    ? (conValoracion.reduce((t, f) => t + (f.n.valoracion ?? 0), 0) / conValoracion.length).toFixed(1)
    : '—';
  const top5 = [...todas]
    .filter((f) => !f.analisis && (!f.n.estadoNegocio || f.n.estadoNegocio === 'OPERATIONAL'))
    .sort((a, b) => puntuar(b.n, b.analisis).total - puntuar(a.n, a.analisis).total)
    .slice(0, 5)
    .map((f) => f.n);
  const guardarUno = async (id: string) => {
    await guardarVarios([id]);
    const n = todas.find((f) => f.n.id === id)?.n;
    avisar(`${n?.nombre ?? 'Negocio'} guardado en Mis leads`, { enlace: { a: `/negocio/${id}`, texto: 'Abrir ficha' } });
  };
  const props = {
    alGuardar: guardarUno,
    filas,
    seleccion: s.seleccion,
    alternar: s.alternar,
    alternarTodos: () => {
      const ids = filas.map((f) => f.n.id);
      const todos = ids.every((id) => s.seleccion.includes(id));
      s.set({ seleccion: todos ? s.seleccion.filter((id) => !ids.includes(id)) : [...new Set([...s.seleccion, ...ids])] });
    },
  };

  return (
    <div className="pila">
      <div className="cabecera">
        <div>
          <h1>Buscar negocios</h1>
          <p>Encuentra negocios de una zona, mira si tienen web y prepara el primer contacto.</p>
        </div>
      </div>

      <form
        className="panel panel-cuerpo"
        onSubmit={(e) => {
          e.preventDefault();
          ejecutar(s.nicho, s.zona);
        }}
      >
        <div className="form-busqueda">
          <label className="campo">
            Zona
            <input value={s.zona} onChange={(e) => s.set({ zona: e.target.value })} placeholder="Ciudad, barrio o código postal — p. ej. Cuenca, Ecuador" required />
          </label>
          <label className="campo">
            Nicho
            <input list="nichos" value={s.nicho} onChange={(e) => s.set({ nicho: e.target.value })} placeholder="p. ej. talleres mecánicos" required />
            <datalist id="nichos">
              {NICHOS_SUGERIDOS.map((n) => <option key={n} value={n} />)}
            </datalist>
          </label>
          <button className="primario" type="submit" disabled={s.cargando}>
            {s.cargando ? <span className="girando" /> : null} Buscar
          </button>
        </div>
        <div className="filtros">
          <label className="check"><input type="checkbox" checked={s.filtros.soloSinWeb} onChange={(e) => s.setFiltros({ soloSinWeb: e.target.checked })} /> Solo sin web</label>
          <label className="check"><input type="checkbox" checked={s.filtros.soloConTelefono} onChange={(e) => s.setFiltros({ soloConTelefono: e.target.checked })} /> Solo con teléfono</label>
          <label className="check"><input type="checkbox" checked={s.filtros.ocultarCerrados} onChange={(e) => s.setFiltros({ ocultarCerrados: e.target.checked })} /> Ocultar cerrados</label>
          <label className="en-linea">Valoración mín.
            <input type="number" min={0} max={5} step={0.1} value={s.filtros.valoracionMin} onChange={(e) => s.setFiltros({ valoracionMin: Number(e.target.value) || 0 })} />
          </label>
          <label className="en-linea">Reseñas mín.
            <input type="number" min={0} step={1} value={s.filtros.resenasMin} onChange={(e) => s.setFiltros({ resenasMin: Number(e.target.value) || 0 })} />
          </label>
        </div>
      </form>

      {s.error && <ErrorCaja titulo="La búsqueda falló" mensaje={s.error} />}
      {aviso && <div className="info-caja">{aviso}</div>}

      {s.cargando && !s.cache && (
        <div className="panel panel-cuerpo pila">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="esqueleto" style={{ width: `${90 - i * 7}%` }} />)}
        </div>
      )}

      {!s.cache && !s.cargando && !s.error && (
        <div className="panel">
          <Vacio titulo="¿Qué tipo de negocio quieres encontrar?">
            Escribe la zona y el tipo de negocio arriba, o prueba un ejemplo:
            <div className="ejemplos">
              {['guarderías', 'clínicas dentales', 'talleres mecánicos', 'peluquerías', 'restaurantes'].map((nicho) => (
                <button key={nicho} type="button" className="pequeno" onClick={() => ejecutar(nicho, s.zona.trim() || 'Cuenca, Ecuador')}>
                  {nicho} en {s.zona.trim() || 'Cuenca'}
                </button>
              ))}
            </div>
            <div className="proceso" style={{ marginTop: 24, textAlign: 'left' }}>
              {[
                ['1', 'Busca', 'Ves teléfono, si tiene web y una nota de oportunidad.'],
                ['2', 'Guarda', 'Toca «+ Guardar» en los que te interesen.'],
                ['3', 'Abre su ficha', 'Toca el nombre: la app te guía paso a paso.'],
              ].map(([n, t, d]) => (
                <div key={n} className="paso"><span className="num">{n}</span><strong>{t}</strong><small className="tenue">{d}</small></div>
              ))}
            </div>
            <small className="muy-tenue" style={{ display: 'block', marginTop: 12 }}>
              Cada página de 20 resultados gasta una llamada a Google Places; repetir una búsqueda no gasta.
            </small>
          </Vacio>
        </div>
      )}

      {s.cache && todas.length > 0 && (
        <div className="cifras">
          <button
            type="button"
            className="cifra destacada"
            disabled={!top5.length}
            onClick={() => analizar(top5)}
            title="Analiza la web de los negocios con mayor puntuación que aún no se han analizado"
          >
            <Icono nombre="radar" tam={20} />
            <span>{top5.length ? `Analizar los ${top5.length} con más oportunidad` : 'Todos analizados'}</span>
          </button>
          <div className="cifra"><strong>{todas.length}</strong><span>negocios encontrados</span></div>
          <div className="cifra"><strong>{todas.length ? Math.round((sinWeb / todas.length) * 100) : 0}%</strong><span>sin web propia</span></div>
          <div className="cifra"><strong>{conTelefono}</strong><span>con teléfono</span></div>
          <div className="cifra"><strong>{mediaValoracion}</strong><span>valoración media</span></div>
        </div>
      )}

      {s.cache && (
        <section className="panel">
          <div className="panel-cab">
            <div className="fila">
              <h2>{todas.length} negocios</h2>
              <span className="tenue">· {sinWeb} sin web propia · mostrando {filas.length}</span>
              {s.desdeCache && (
                <span className="etiqueta acento" title="No se gastaron llamadas a Places">
                  De la caché · {fechaCorta(s.cache.fecha)}
                </span>
              )}
              {s.cargando && <Cargando texto="Actualizando…" />}
            </div>
            <div className="fila">
              {s.desdeCache && (
                <button className="pequeno" onClick={() => ejecutar(s.cache!.nicho, s.cache!.zona, true)} disabled={s.cargando}>
                  Actualizar (1 llamada)
                </button>
              )}
              <button className="pequeno" onClick={() => exportar('excel')} disabled={!filas.length || !!exportando} title="Descarga un Excel con todos los datos de los negocios que se ven en la lista">
                {exportando === 'excel' ? <span className="girando" /> : <Icono nombre="descargar" tam={14} />} Excel
              </button>
              <button className="pequeno" onClick={() => exportar('pdf')} disabled={!filas.length || !!exportando} title="Descarga un PDF con el listado de los negocios que se ven en la lista">
                {exportando === 'pdf' ? <span className="girando" /> : <Icono nombre="descargar" tam={14} />} PDF
              </button>
              <select value={s.orden} onChange={(e) => s.set({ orden: e.target.value as Orden })} aria-label="Ordenar por">
                <option value="oportunidad">Mayor oportunidad</option>
                <option value="google">Orden de Google</option>
                <option value="resenas">Más reseñas</option>
                <option value="valoracion">Mejor valoración</option>
              </select>
              <div className="segmentado solo-escritorio" role="group" aria-label="Vista">
                <button type="button" aria-pressed={s.vista === 'tabla'} onClick={() => s.set({ vista: 'tabla' })}>Tabla</button>
                <button type="button" aria-pressed={s.vista === 'tarjetas'} onClick={() => s.set({ vista: 'tarjetas' })}>Tarjetas</button>
              </div>
            </div>
          </div>

          {filas.length === 0 ? (
            <Vacio titulo={todas.length ? 'Ningún negocio cumple los filtros' : 'Places no encontró negocios'}>
              {todas.length ? 'Prueba a relajar los filtros.' : 'Prueba con otra zona o un nicho más general.'}
            </Vacio>
          ) : vista === 'tabla' ? (
            <TablaNegocios {...props} />
          ) : (
            <div className="panel-cuerpo"><TarjetasNegocios {...props} /></div>
          )}

          <div className="panel-cuerpo fila entre" style={{ borderTop: '1px solid var(--borde)' }}>
            <span className="tenue">
              Página {s.cache.paginas.length} de {MAX_PAGINAS} como máximo ({s.cache.paginas.length * 20 >= 60 ? 'límite de 60 alcanzado' : 'hasta 60 resultados por búsqueda'})
            </span>
            {s.cache.nextPageToken && s.cache.paginas.length < MAX_PAGINAS ? (
              <button onClick={masResultados} disabled={s.cargandoMas}>
                {s.cargandoMas ? <span className="girando" /> : null} Cargar más (1 llamada)
              </button>
            ) : (
              <span className="muy-tenue">No hay más resultados</span>
            )}
          </div>
        </section>
      )}

      {s.seleccion.length > 0 && (
        <div className="barra-seleccion no-imprimir">
          <span>{s.seleccion.length} seleccionados</span>
          <div className="fila">
            <button onClick={() => s.set({ seleccion: [] })}>Quitar selección</button>
            <button
              onClick={async () => {
                await guardarVarios(s.seleccion);
                avisar(`${s.seleccion.length} negocio(s) guardados en Mis leads`, { enlace: { a: '/leads', texto: 'Ver' } });
                s.set({ seleccion: [] });
              }}
            >
              Guardar en mis leads
            </button>
            <button
              className="primario"
              onClick={() => {
                analizar(seleccionados);
                s.set({ seleccion: [] });
              }}
            >
              Analizar seleccionados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
