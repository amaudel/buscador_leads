import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVICIOS, type MetricaNicho, type RadarNichos as Radar } from '../../shared/tipos';
import { api, mensajeError } from '../api/cliente';
import { Cargando, ErrorCaja, Modal, Vacio } from '../componentes/ui';
import { repo } from '../datos';
import { useAjustes, usoDelMes } from '../datos/ajustes';
import { buscar, cacheVigente, aNegocio } from '../logica/busqueda';
import { enCola } from '../logica/cola';
import { calcularMetrica } from '../logica/nichos';
import { colorOportunidad } from '../logica/puntuacion';
import { NICHOS_SUGERIDOS, fechaCorta, normalizar } from '../logica/texto';

const claveRadar = (zona: string, region: string) => `${normalizar(zona)}|${region}`;

export function RadarNichos() {
  const navegar = useNavigate();
  const ajustes = useAjustes();
  const [zona, setZona] = useState('');
  const [categorias, setCategorias] = useState<string[]>(NICHOS_SUGERIDOS);
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState<{ llamadas: number; enCache: number } | null>(null);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number; fase: 'places' | 'gemini' } | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [radar, setRadar] = useState<Radar | null>(null);

  useEffect(() => {
    repo.listarRadares().then((rs) => {
      const ultimo = rs.sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      if (ultimo) {
        setRadar(ultimo);
        setZona(ultimo.zona);
      }
    });
  }, []);

  const preparar = async () => {
    if (!zona.trim() || !categorias.length) return;
    const enCache = (await Promise.all(categorias.map((c) => cacheVigente(c, zona, ajustes.regionCode)))).filter(Boolean).length;
    setConfirmar({ llamadas: categorias.length - enCache, enCache });
  };

  const ejecutar = async () => {
    setConfirmar(null);
    setErrores([]);
    const errs: string[] = [];
    const metricas: MetricaNicho[] = [];
    setProgreso({ hechas: 0, total: categorias.length, fase: 'places' });
    let hechas = 0;
    await enCola(categorias, async (cat) => {
      try {
        const { cache } = await buscar(cat, zona, ajustes.regionCode);
        metricas.push(calcularMetrica(cat, (cache.paginas[0] ?? []).map((p) => aNegocio(p, cat, zona))));
      } catch (e) {
        errs.push(`${cat}: ${mensajeError(e)}`);
      } finally {
        setProgreso({ hechas: ++hechas, total: categorias.length, fase: 'places' });
      }
    }, 3);
    metricas.sort((a, b) => categorias.indexOf(a.categoria) - categorias.indexOf(b.categoria));
    const base: Radar = { clave: claveRadar(zona, ajustes.regionCode), zona: zona.trim(), fecha: new Date().toISOString(), metricas, ranking: null };
    setRadar(base);
    const conDatos = metricas.filter((m) => m.total > 0);
    if (conDatos.length) {
      setProgreso({ hechas, total: categorias.length, fase: 'gemini' });
      try {
        base.ranking = await api.nichos(zona.trim(), conDatos, ajustes.perfil);
      } catch (e) {
        errs.push(`Gemini: ${mensajeError(e)}`);
      }
    }
    await repo.guardarRadar(base);
    setRadar({ ...base });
    setErrores(errs);
    setProgreso(null);
  };

  const uso = usoDelMes(ajustes);
  const ranking = radar?.ranking?.ranking ?? [];
  const metrica = (cat: string) => radar?.metricas.find((m) => normalizar(m.categoria) === normalizar(cat));
  const verNegocios = (cat: string) => navegar(`/buscar?nicho=${encodeURIComponent(cat)}&zona=${encodeURIComponent(radar?.zona ?? zona)}`);
  const filasTabla = ranking.length
    ? ranking.map((r) => ({ cat: r.categoria, r, m: metrica(r.categoria) }))
    : (radar?.metricas ?? []).map((m) => ({ cat: m.categoria, r: undefined, m }));

  return (
    <div className="pila">
      <div className="cabecera">
        <div>
          <h1>Radar de nichos</h1>
          <p>Compara categorías en una zona y descubre dónde hay más negocios sin web propia y con actividad.</p>
        </div>
      </div>

      <form className="panel panel-cuerpo pila" onSubmit={(e) => { e.preventDefault(); preparar(); }}>
        <div className="form-busqueda" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
          <label className="campo">
            Zona
            <input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="p. ej. Cuenca, Ecuador" required />
          </label>
          <button className="primario" type="submit" disabled={!!progreso || !categorias.length}>Analizar zona</button>
        </div>
        <div className="pila" style={{ gap: 6 }}>
          <span className="fila entre">
            <h3>Categorías ({categorias.length})</h3>
            <span className="fila" style={{ gap: 4 }}>
              <button type="button" className="pequeno fantasma" onClick={() => setCategorias(NICHOS_SUGERIDOS)}>Restaurar sugerencias</button>
              <button type="button" className="pequeno fantasma" onClick={() => setCategorias([])}>Vaciar</button>
            </span>
          </span>
          <div className="chips">
            {categorias.map((c) => (
              <span key={c} className="chip">
                {c}
                <button type="button" aria-label={`Quitar ${c}`} onClick={() => setCategorias(categorias.filter((x) => x !== c))}>×</button>
              </span>
            ))}
          </div>
          <div className="fila">
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Añadir categoría (p. ej. guarderías)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (nueva.trim() && !categorias.includes(nueva.trim())) setCategorias([...categorias, nueva.trim()]);
                  setNueva('');
                }
              }}
              style={{ flex: '1 1 240px' }}
            />
            <button type="button" onClick={() => { if (nueva.trim() && !categorias.includes(nueva.trim())) setCategorias([...categorias, nueva.trim()]); setNueva(''); }}>Añadir</button>
          </div>
        </div>
      </form>

      {confirmar && (
        <Modal titulo="Confirmar llamadas a Places" onCerrar={() => setConfirmar(null)}>
          <p style={{ margin: 0 }}>
            Se buscará la primera página (hasta 20 negocios) de {categorias.length} categorías en <strong>{zona}</strong>.
          </p>
          <div className="info-caja">
            Gastará <strong>{confirmar.llamadas} llamada(s) a Places</strong>
            {confirmar.enCache ? ` (${confirmar.enCache} categoría(s) salen de la caché, sin coste)` : ''}. Este mes llevas {uso} de {ajustes.limiteMensual}
            {uso + confirmar.llamadas > ajustes.umbralAviso ? '; con esto superarás el aviso de ' + ajustes.umbralAviso : ''}. Además hará 1 llamada a Gemini.
          </div>
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmar(null)}>Cancelar</button>
            <button className="primario" onClick={ejecutar}>Continuar</button>
          </div>
        </Modal>
      )}

      {progreso && (
        <div className="panel panel-cuerpo pila" style={{ gap: 8 }}>
          <Cargando texto={progreso.fase === 'places' ? `Buscando categorías en Places: ${progreso.hechas} de ${progreso.total}…` : 'Gemini está ordenando las categorías…'} />
          <div className="barra"><span style={{ width: `${(progreso.hechas / progreso.total) * 100}%` }} /></div>
        </div>
      )}
      {errores.length > 0 && <ErrorCaja titulo="Algunas consultas fallaron" mensaje={errores.join(' · ')} />}

      {!radar && !progreso && (
        <div className="panel"><Vacio titulo="Escribe una zona y pulsa «Analizar zona»">Antes de gastar nada te diré cuántas llamadas a Places va a hacer.</Vacio></div>
      )}

      {radar && !progreso && (
        <>
          <div className="fila entre">
            <h2>Resultado para {radar.zona}</h2>
            <small>{fechaCorta(radar.fecha)}{radar.ranking ? ` · ${radar.ranking.modelo}` : ''}</small>
          </div>
          {radar.ranking && (
            <>
              <div className="top3">
                {ranking.slice(0, 3).map((r, i) => (
                  <div key={r.categoria} className="panel panel-cuerpo pila" style={{ gap: 8 }}>
                    <div className="fila entre">
                      <span className="puesto">{i + 1}</span>
                      <span className={`nota ${colorOportunidad(r.puntuacion)}`}>{r.puntuacion}</span>
                    </div>
                    <h2 style={{ textTransform: 'capitalize' }}>{r.categoria}</h2>
                    <p style={{ margin: 0 }} className="tenue">{r.porque}</p>
                    <div><span className="etiqueta acento">Vender: {SERVICIOS[r.servicio] ?? r.servicio}</span></div>
                    <button onClick={() => verNegocios(r.categoria)}>Ver negocios</button>
                  </div>
                ))}
              </div>
              <div className="info-caja">{radar.ranking.conclusion}</div>
            </>
          )}
          <div className="panel">
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>#</th><th>Categoría</th><th className="num">Negocios</th><th className="num">% sin web propia</th>
                    <th className="num">Valoración media</th><th className="num">Media reseñas</th><th>Oport.</th><th>Por qué / qué vender</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filasTabla.map(({ cat, r, m }, i) => (
                    <tr key={cat}>
                      <td className="tenue">{r ? i + 1 : ''}</td>
                      <td className="nombre" style={{ textTransform: 'capitalize' }}>{cat}</td>
                      <td className="num">{m ? `${m.total}${m.total >= 20 ? '+' : ''}` : '—'}</td>
                      <td className="num">{m ? <span className={`nota ${colorOportunidad(m.pctSinWeb)}`}>{m.pctSinWeb}%</span> : '—'}</td>
                      <td className="num">{m?.mediaValoracion ?? '—'}</td>
                      <td className="num">{m?.mediaResenas ?? '—'}</td>
                      <td>{r ? <span className={`nota ${colorOportunidad(r.puntuacion)}`}>{r.puntuacion}</span> : '—'}</td>
                      <td style={{ maxWidth: 380 }} className="tenue">
                        {r ? <>{r.porque} <strong style={{ color: 'var(--texto)' }}>→ {SERVICIOS[r.servicio] ?? r.servicio}</strong></> : m?.total === 0 ? 'Sin resultados' : ''}
                      </td>
                      <td><button className="pequeno" onClick={() => verNegocios(cat)}>Ver negocios</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-cuerpo"><small>«% sin web propia» incluye negocios con solo redes sociales o directorios. Máximo 20 negocios por categoría (una página de Places); 20+ indica que hay más.</small></div>
          </div>
        </>
      )}
    </div>
  );
}
