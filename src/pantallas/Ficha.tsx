import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SERVICIOS, TONOS, type Analisis, type Borradores, type EstadoCheck, type Lead, type Negocio } from '../../shared/tipos';
import { api, mensajeError } from '../api/cliente';
import {
  Anillo, BotonCopiar, Cargando, ErrorCaja, EtiquetaWeb, Icono, SelectorEstado, TablaDesglose, Vacio,
} from '../componentes/ui';
import { repo } from '../datos';
import { useAjustes } from '../datos/ajustes';
import { useCola } from '../estado/analisis';
import { useDatos } from '../estado/useDatos';
import { etiquetaWeb } from '../logica/clasificarWeb';
import { actualizarLead, asegurarLead } from '../logica/leads';
import { colorOportunidad, puntuar } from '../logica/puntuacion';
import { fechaCorta, telefonoEnlace, whatsappEnlace } from '../logica/texto';

export const AVISO_BORRADORES =
  'Borradores para contactar de forma personal. No envíes mensajes comerciales masivos sin consentimiento.';

const CHECKS: { clave: keyof NonNullable<NonNullable<Analisis['gemini']>['checklist']>; texto: string; malo: EstadoCheck }[] = [
  { clave: 'https', texto: 'HTTPS', malo: 'no' },
  { clave: 'adaptadaMovil', texto: 'Adaptada a móvil', malo: 'no' },
  { clave: 'botonWhatsapp', texto: 'Botón de WhatsApp', malo: 'no' },
  { clave: 'citaOnline', texto: 'Cita o reserva online', malo: 'no' },
  { clave: 'formularioContacto', texto: 'Formulario de contacto', malo: 'no' },
  { clave: 'desactualizada', texto: 'Señales de web desactualizada', malo: 'si' },
];

export function IconoCheck({ estado, malo }: { estado: EstadoCheck; malo: EstadoCheck }) {
  if (estado === 'desconocido') return <span className="ico muy-tenue" title="No se pudo comprobar">?</span>;
  const mal = estado === malo;
  return <span className={`ico ${mal ? 'c-rojo' : 'c-verde'}`}>{mal ? '✕' : '✓'}</span>;
}

export function Ficha() {
  const { id = '' } = useParams();
  const { datos, cargando } = useDatos(async () => {
    const [n, lead, analisis, borradores] = await Promise.all([
      repo.obtenerNegocio(id), repo.obtenerLead(id), repo.obtenerAnalisis(id), repo.obtenerBorradores(id),
    ]);
    return { n, lead, analisis, borradores };
  }, [id]);

  if (cargando) return <Cargando texto="Cargando ficha…" />;
  if (!datos?.n)
    return (
      <div className="panel">
        <Vacio titulo="No encontramos este negocio">
          Puede que se hayan borrado los datos locales. <Link to="/buscar">Volver a Buscar</Link>
        </Vacio>
      </div>
    );
  return <FichaContenido key={datos.n.id} n={datos.n} lead={datos.lead} analisis={datos.analisis} borradores={datos.borradores} />;
}

function FichaContenido({ n, lead, analisis, borradores }: { n: Negocio; lead?: Lead; analisis?: Analisis; borradores?: Borradores }) {
  const navegar = useNavigate();
  const p = puntuar(n, analisis);
  const tel = telefonoEnlace(n);
  return (
    <div className="pila">
      <div className="cabecera">
        <div style={{ minWidth: 0 }}>
          <button className="fantasma pequeno" onClick={() => navegar(-1)} style={{ marginLeft: -8 }}>
            <Icono nombre="volver" tam={14} /> Volver
          </button>
          <h1>{n.nombre}</h1>
          <p>
            {n.dedicacion ?? n.nicho} · {n.zona}
            {n.estadoNegocio && n.estadoNegocio !== 'OPERATIONAL' && <span className="etiqueta rojo" style={{ marginLeft: 8 }}>Cerrado</span>}
          </p>
        </div>
        <div className="fila">
          {tel && <a className="boton primario" href={tel}><Icono nombre="tel" tam={15} /> Llamar</a>}
          {n.web && <a className="boton" href={n.web} target="_blank" rel="noopener noreferrer"><Icono nombre="web" tam={15} /> Abrir web</a>}
          {n.mapsUrl && <a className="boton" href={n.mapsUrl} target="_blank" rel="noopener noreferrer"><Icono nombre="mapa" tam={15} /> Google Maps</a>}
          <a className="boton" href={`/negocio/${n.id}/imprimir`} target="_blank" rel="noopener"><Icono nombre="imprimir" tam={15} /> Exportar ficha</a>
        </div>
      </div>

      <div className="rejilla-ficha">
        <div className="pila">
          <PanelAnalisis n={n} analisis={analisis} />
          <PanelContacto n={n} analisis={analisis} borradores={borradores} />
        </div>
        <div className="pila">
          <section className="panel contacto">
            <div className="panel-cab"><h2>Datos de contacto</h2></div>
            <div className="panel-cuerpo">
              <dl>
                <dt>Teléfono</dt>
                <dd>{tel ? <a href={tel}>{n.telNacional ?? n.telInternacional}</a> : '—'}</dd>
                <dt>Internacional</dt>
                <dd>{n.telInternacional ?? '—'}</dd>
                <dt>Web</dt>
                <dd><EtiquetaWeb n={n} recortar={false} /></dd>
                <dt>Dirección</dt>
                <dd>{n.direccion ?? '—'}</dd>
                <dt>Valoración</dt>
                <dd>{n.valoracion != null ? `★ ${n.valoracion.toFixed(1)} (${n.numResenas} reseñas)` : 'Sin valoraciones'}</dd>
                <dt>Categoría</dt>
                <dd>{n.dedicacion ?? '—'}</dd>
                {analisis?.gemini?.correos.length ? (<><dt>Correos</dt><dd>{analisis.gemini.correos.map((c) => <div key={c}><a href={`mailto:${c}`}>{c}</a></div>)}</dd></>) : null}
                {analisis?.gemini?.redes.length ? (<><dt>Redes</dt><dd>{analisis.gemini.redes.map((r) => <div key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.red}</a></div>)}</dd></>) : null}
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel-cab">
              <h2>Oportunidad</h2>
              <span className={`nota ${colorOportunidad(p.total)} ${p.provisional ? 'provisional' : ''}`} style={{ fontSize: 15, height: 30, minWidth: 44 }}>
                {p.total}
              </span>
            </div>
            <div className="panel-cuerpo pila" style={{ gap: 8 }}>
              {p.etiqueta === 'Sin web' && <span className="etiqueta rojo" style={{ alignSelf: 'flex-start' }}>Oportunidad: {etiquetaWeb(n.tipoWeb)}</span>}
              {p.provisional && <small>Provisional: calculada solo con los datos de Google Maps. Analiza la web para afinarla.</small>}
              <TablaDesglose p={p} />
            </div>
          </section>

          <PanelSeguimiento n={n} lead={lead} />
        </div>
      </div>
    </div>
  );
}

function PanelAnalisis({ n, analisis }: { n: Negocio; analisis?: Analisis }) {
  const item = useCola((c) => c.items[n.id]);
  const analizar = useCola((c) => c.analizar);
  const ocupado = item && ['en_cola', 'pagespeed', 'gemini'].includes(item.fase);
  const conWeb = n.tipoWeb === 'propia';
  const g = analisis?.gemini;
  const ps = analisis?.pagespeed;

  return (
    <section className="panel">
      <div className="panel-cab">
        <div>
          <h2>Análisis {conWeb ? 'de la web' : 'del negocio'}</h2>
          {analisis && <small>Último análisis: {fechaCorta(analisis.fecha)}{g ? ` · ${g.modelo} · ${g.modo}` : ''}</small>}
        </div>
        <button className="primario" onClick={() => analizar([n])} disabled={ocupado}>
          {ocupado ? <span className="girando" /> : null}
          {ocupado ? 'Analizando…' : analisis ? 'Volver a analizar' : 'Analizar'}
        </button>
      </div>
      <div className="panel-cuerpo pila">
        {ocupado && (
          <div className="info-caja fases">
            {conWeb && <span className={item.fase === 'pagespeed' ? '' : 'muy-tenue'}>{item.fase === 'pagespeed' ? <Cargando texto="PageSpeed (móvil)…" /> : '1. PageSpeed'}</span>}
            <span>→</span>
            <span className={item.fase === 'gemini' ? '' : 'muy-tenue'}>{item.fase === 'gemini' ? <Cargando texto="Gemini leyendo y analizando…" /> : '2. Gemini'}</span>
            <span className="muy-tenue">· suele tardar entre 10 y 30 segundos</span>
          </div>
        )}
        {item?.fase === 'error' && <ErrorCaja titulo="El análisis falló" mensaje={item.error ?? ''} />}
        {!conWeb && (
          <div className="aviso-caja">
            <strong>Oportunidad: Sin web.</strong>{' '}
            {n.tipoWeb === 'ninguna' ? 'No figura ninguna web en Google Maps.' : `Solo figura ${etiquetaWeb(n.tipoWeb).toLowerCase()} (${n.web}).`} No se llama a PageSpeed.
          </div>
        )}
        {!analisis && !ocupado && (
          <Vacio titulo="Todavía no se ha analizado">
            {conWeb ? 'Pulsa «Analizar» para pasar PageSpeed en móvil y que Gemini lea la web.' : 'Pulsa «Analizar» para que Gemini resuma el negocio y proponga qué venderle.'}
          </Vacio>
        )}
        {analisis?.errores.length ? (
          <ErrorCaja titulo="Parte del análisis falló" mensaje={analisis.errores.join(' · ')} />
        ) : null}
        {g?.avisos.length ? <div className="aviso-caja">{g.avisos.join(' ')}</div> : null}

        {ps && (
          <div className="fila" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: '1 1 300px' }} className="pila">
              <h3>PageSpeed en móvil</h3>
              <div className="anillos">
                <Anillo valor={ps.notas.performance} etiqueta="Rendimiento" />
                <Anillo valor={ps.notas.seo} etiqueta="SEO" />
                <Anillo valor={ps.notas.accessibility} etiqueta="Accesibilidad" />
                <Anillo valor={ps.notas.bestPractices} etiqueta="Buenas prácticas" />
              </div>
              {ps.auditorias.length > 0 && (
                <table className="desglose">
                  <tbody>
                    {ps.auditorias.filter((a) => a.valor).map((a) => (
                      <tr key={a.id}><td>{a.titulo}</td><td className={a.ok === false ? 'neg' : a.ok ? 'pos' : ''}>{a.valor}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {ps.captura && <img className="captura" src={ps.captura} alt={`Captura de ${n.web} en móvil`} />}
          </div>
        )}

        {g && (
          <>
            <div className="pila" style={{ gap: 6 }}>
              <h3>A qué se dedica</h3>
              <p style={{ margin: 0 }}>{g.resumen}</p>
            </div>
            {g.checklist && (
              <div className="pila" style={{ gap: 6 }}>
                <h3>Lista de comprobación</h3>
                <ul className="checklist">
                  {CHECKS.map((c) => (
                    <li key={c.clave}>
                      <IconoCheck estado={g.checklist![c.clave].estado} malo={c.malo} />
                      <strong>{c.texto}</strong>
                      <span className="tenue det">{g.checklist![c.clave].detalle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pila" style={{ gap: 6 }}>
              <h3>Problemas detectados</h3>
              <ol className="problemas">
                {g.problemas.map((p, i) => (
                  <li key={i}><strong>{p.titulo}.</strong> <span className="tenue">{p.explicacion}</span></li>
                ))}
              </ol>
            </div>
            <div className="info-caja" style={{ borderColor: 'var(--acento)', background: 'var(--acento-suave)', color: 'var(--texto)' }}>
              <strong style={{ color: 'var(--acento)' }}>Qué le ofrecería: {SERVICIOS[g.servicio.tipo] ?? g.servicio.tipo}.</strong> {g.servicio.porque}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function PanelContacto({ n, analisis, borradores }: { n: Negocio; analisis?: Analisis; borradores?: Borradores }) {
  const perfil = useAjustes((a) => a.perfil);
  const [tono, setTono] = useState(borradores?.tono ?? perfil.tono ?? 'profesional');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wa = whatsappEnlace(n);
  const correoDestino = analisis?.gemini?.correos[0];

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      const g = analisis?.gemini;
      const r = await api.borradores({
        negocio: n,
        analisis: g ? { resumen: g.resumen, problemas: g.problemas, servicio: g.servicio } : null,
        sinWebPropia: n.tipoWeb !== 'propia',
        perfil,
        tono,
      });
      await repo.guardarBorradores({
        negocioId: n.id, tono, fecha: new Date().toISOString(), llamada: r.llamada, whatsapp: r.whatsapp, correo: r.correo,
      });
      await asegurarLead(n.id);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-cab">
        <h2>Primer contacto</h2>
        <div className="fila">
          <select value={tono} onChange={(e) => setTono(e.target.value)} aria-label="Tono">
            {TONOS.map((t) => <option key={t} value={t}>Tono {t}</option>)}
          </select>
          <button className={borradores ? '' : 'primario'} onClick={generar} disabled={cargando}>
            {cargando ? <span className="girando" /> : null}
            {borradores ? 'Regenerar con este tono' : 'Redactar borradores'}
          </button>
        </div>
      </div>
      <div className="panel-cuerpo pila">
        <div className="aviso-caja">{AVISO_BORRADORES}</div>
        {!perfil.nombre && (
          <small>
            Consejo: completa <Link to="/ajustes">tu perfil de vendedor</Link> para que los borradores lleven tu nombre y tu propuesta.
          </small>
        )}
        {!analisis && <small>Sin análisis previo los borradores serán más genéricos. Mejor analiza primero.</small>}
        {error && <ErrorCaja titulo="No se pudieron redactar los borradores" mensaje={error} />}
        {cargando && !borradores && <Cargando texto="Gemini está redactando…" />}
        {borradores && (
          <>
            <small>Tono {borradores.tono} · {fechaCorta(borradores.fecha)}</small>
            <div className="borrador">
              <div className="cab"><strong>Guion de llamada (30 s)</strong><BotonCopiar texto={borradores.llamada} /></div>
              <pre>{borradores.llamada}</pre>
            </div>
            <div className="borrador">
              <div className="cab">
                <strong>WhatsApp</strong>
                <span className="fila" style={{ gap: 4 }}>
                  <BotonCopiar texto={borradores.whatsapp} />
                  {wa && (
                    <a className="boton pequeno" href={`${wa}?text=${encodeURIComponent(borradores.whatsapp)}`} target="_blank" rel="noopener noreferrer" title="Abre WhatsApp con el texto; tú decides si lo envías">
                      <Icono nombre="wa" tam={14} /> Abrir en WhatsApp
                    </a>
                  )}
                </span>
              </div>
              <pre>{borradores.whatsapp}</pre>
            </div>
            <div className="borrador">
              <div className="cab">
                <strong>Correo</strong>
                <span className="fila" style={{ gap: 4 }}>
                  <BotonCopiar texto={`Asunto: ${borradores.correo.asunto}\n\n${borradores.correo.cuerpo}`} />
                  {correoDestino && (
                    <a className="boton pequeno" href={`mailto:${correoDestino}?subject=${encodeURIComponent(borradores.correo.asunto)}&body=${encodeURIComponent(borradores.correo.cuerpo)}`}>
                      Abrir en mi correo
                    </a>
                  )}
                </span>
              </div>
              <pre><strong>Asunto:</strong> {borradores.correo.asunto}{'\n\n'}{borradores.correo.cuerpo}</pre>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function PanelSeguimiento({ n, lead }: { n: Negocio; lead?: Lead }) {
  const [notas, setNotas] = useState(lead?.notas ?? '');
  const [guardado, setGuardado] = useState(true);
  const temporizador = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (guardado) setNotas(lead?.notas ?? '');
  }, [lead?.notas, guardado]);

  const guardarNotas = (texto: string) => {
    setNotas(texto);
    setGuardado(false);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(async () => {
      await actualizarLead(n.id, { notas: texto });
      setGuardado(true);
    }, 600);
  };

  return (
    <section className="panel">
      <div className="panel-cab">
        <h2>Seguimiento</h2>
        {!lead && <button className="pequeno" onClick={() => asegurarLead(n.id)}>Guardar en mis leads</button>}
      </div>
      <div className="panel-cuerpo pila" style={{ gap: 10 }}>
        <div className="rejilla-2" style={{ gap: 10 }}>
          <label className="campo">
            Estado
            <SelectorEstado valor={lead?.estado ?? 'nuevo'} alCambiar={(estado) => actualizarLead(n.id, { estado })} />
          </label>
          <label className="campo">
            Próxima acción
            <input type="date" value={lead?.proximaAccion ?? ''} onChange={(e) => actualizarLead(n.id, { proximaAccion: e.target.value || null })} />
          </label>
        </div>
        <label className="campo">
          <span className="fila entre">Notas <span className="muy-tenue" style={{ fontWeight: 400 }}>{guardado ? 'Guardado' : 'Guardando…'}</span></span>
          <textarea value={notas} onChange={(e) => guardarNotas(e.target.value)} placeholder="Con quién hablaste, qué te dijo, objeciones…" rows={5} />
        </label>
        {lead && <small>En leads desde {fechaCorta(lead.creado)}</small>}
      </div>
    </section>
  );
}
