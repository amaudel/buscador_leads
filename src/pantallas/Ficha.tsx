import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SERVICIOS, TONOS, type Analisis, type Borradores, type EstadoCheck, type Lead, type Negocio } from '../../shared/tipos';
import { api, mensajeError } from '../api/cliente';
import {
  Anillo, BotonCopiar, Cargando, ErrorCaja, EstadoBadge, EtiquetaWeb, Icono, SelectorEstado, TablaDesglose, Vacio,
} from '../componentes/ui';
import { Ayuda } from '../componentes/Ayuda';
import { avisar } from '../componentes/Toast';
import { DuenoSri } from '../componentes/DuenoSri';
import { repo } from '../datos';
import { useAjustes } from '../datos/ajustes';
import { useCola } from '../estado/analisis';
import { useDatos } from '../estado/useDatos';
import { etiquetaWeb } from '../logica/clasificarWeb';
import { actualizarLead, asegurarLead } from '../logica/leads';
import { colorOportunidad, puntuar } from '../logica/puntuacion';
import { PASOS, enDias, progreso, siguientePaso, type PasoId } from '../logica/pasos';
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
  const [params, setParams] = useSearchParams();
  const analizar = useCola((c) => c.analizar);
  const itemCola = useCola((c) => c.items[n.id]);
  const tel = telefonoEnlace(n);
  const prog = progreso(lead, analisis, borradores);
  const sig = siguientePaso(lead, analisis, borradores);
  const pasoUrl = params.get('paso') as PasoId | null;
  const paso: PasoId = PASOS.some((x) => x.id === pasoUrl) ? pasoUrl! : sig.paso;
  const irA = (p: PasoId) => setParams({ paso: p }, { replace: true });
  const hecho: Record<PasoId, boolean> = {
    datos: prog.guardado,
    analisis: prog.analizado,
    dueno: prog.dueno,
    mensajes: prog.mensajes,
    seguimiento: prog.contactado,
  };
  const analizando = itemCola && ['en_cola', 'pagespeed', 'gemini'].includes(itemCola.fase);

  const ejecutar = async () => {
    switch (sig.accion) {
      case 'guardar':
        await asegurarLead(n.id);
        avisar('Guardado en Mis leads', { enlace: { a: '/leads', texto: 'Ver' } });
        break;
      case 'analizar':
        analizar([n]);
        irA('analisis');
        break;
      case 'contactar':
        await actualizarLead(n.id, { estado: 'contactado', proximaAccion: lead?.proximaAccion ?? enDias(3) });
        avisar('Marcado como contactado. Próxima acción en 3 días.');
        irA('seguimiento');
        break;
      default:
        irA(sig.paso);
    }
  };

  return (
    <div className="pila" style={{ gap: 0 }}>
      <div className="cabecera">
        <div style={{ minWidth: 0 }}>
          <button className="fantasma pequeno" onClick={() => navegar(-1)} style={{ marginLeft: -8 }}>
            <Icono nombre="volver" tam={14} /> Volver
          </button>
          <h1>{n.nombre}</h1>
          <p className="fila" style={{ gap: 8 }}>
            <span>{n.dedicacion ?? n.nicho} · {n.zona}</span>
            {lead ? <EstadoBadge estado={lead.estado} /> : <span className="etiqueta">No guardado</span>}
            {n.estadoNegocio && n.estadoNegocio !== 'OPERATIONAL' && <span className="etiqueta rojo">Cerrado</span>}
          </p>
        </div>
        <div className="fila">
          {tel && <a className="boton primario" href={tel}><Icono nombre="tel" tam={15} /> Llamar</a>}
          {n.web && <a className="boton" href={n.web} target="_blank" rel="noopener noreferrer"><Icono nombre="web" tam={15} /> Web</a>}
          {n.mapsUrl && <a className="boton" href={n.mapsUrl} target="_blank" rel="noopener noreferrer"><Icono nombre="mapa" tam={15} /> Maps</a>}
          <a className="boton" href={`/negocio/${n.id}/imprimir`} target="_blank" rel="noopener"><Icono nombre="imprimir" tam={15} /> PDF</a>
        </div>
      </div>

      <div className="pestanas-pasos" role="tablist" aria-label="Pasos">
        {PASOS.map((x) => (
          <button key={x.id} role="tab" aria-selected={paso === x.id} onClick={() => irA(x.id)} title={x.ayuda}>
            <span className={`n ${hecho[x.id] ? 'hecho' : sig.paso === x.id ? 'actual' : ''}`}>{hecho[x.id] ? '✓' : x.n}</span>
            {x.titulo}
          </button>
        ))}
      </div>

      {sig.accion !== 'ninguna' && (
        <div className="siguiente-paso">
          <div>
            <span className="etq">Siguiente paso</span>
            <strong>{sig.texto}</strong>
          </div>
          {!(paso === sig.paso && ['dueno', 'mensajes', 'seguimiento'].includes(sig.accion)) && (
            <button className="primario" onClick={ejecutar} disabled={sig.accion === 'analizar' && analizando}>
              {sig.accion === 'analizar' && analizando ? <><span className="girando" /> Analizando…</> : sig.boton}
            </button>
          )}
          {paso === sig.paso && ['dueno', 'mensajes', 'seguimiento'].includes(sig.accion) && <span className="tenue">Hazlo aquí abajo ↓</span>}
        </div>
      )}
      {sig.accion === 'ninguna' && <div className="siguiente-paso"><strong>{sig.texto}</strong></div>}

      {paso === 'datos' && <PasoDatos n={n} analisis={analisis} />}
      {paso === 'analisis' && <PanelAnalisis n={n} analisis={analisis} />}
      {paso === 'dueno' && <PasoDueno n={n} lead={lead} analisis={analisis} />}
      {paso === 'mensajes' && <PanelContacto n={n} analisis={analisis} borradores={borradores} />}
      {paso === 'seguimiento' && <PanelSeguimiento n={n} lead={lead} />}

      <div className="fila entre" style={{ marginTop: 16 }}>
        {PASOS.findIndex((x) => x.id === paso) > 0 ? (
          <button className="fantasma" onClick={() => irA(PASOS[PASOS.findIndex((x) => x.id === paso) - 1].id)}>← Paso anterior</button>
        ) : <span />}
        {PASOS.findIndex((x) => x.id === paso) < PASOS.length - 1 && (
          <button onClick={() => irA(PASOS[PASOS.findIndex((x) => x.id === paso) + 1].id)}>
            Paso {PASOS.findIndex((x) => x.id === paso) + 2}: {PASOS[PASOS.findIndex((x) => x.id === paso) + 1].titulo} →
          </button>
        )}
      </div>
    </div>
  );
}

function PasoDatos({ n, analisis }: { n: Negocio; analisis?: Analisis }) {
  const p = puntuar(n, analisis);
  const tel = telefonoEnlace(n);
  return (
    <div className="rejilla-2">
      <section className="panel contacto">
        <div className="panel-cab"><h2>Datos de contacto</h2><small>De Google Maps</small></div>
        <div className="panel-cuerpo">
          <dl>
            <dt>Teléfono</dt>
            <dd>{tel ? <a href={tel}>{n.telNacional ?? n.telInternacional}</a> : '—'}</dd>
            <dt>Internacional</dt>
            <dd>{n.telInternacional ?? '—'}</dd>
            <dt>Web <Ayuda termino="webPropia" /></dt>
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
          <h2>Oportunidad <Ayuda termino="oportunidad" /></h2>
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
    </div>
  );
}

function PasoDueno({ n, lead, analisis }: { n: Negocio; lead?: Lead; analisis?: Analisis }) {
  const conWeb = n.tipoWeb === 'propia' && Boolean(n.web);
  const c = lead?.contacto;
  return (
    <div className="rejilla-2">
      <section className="panel">
        <div className="panel-cab"><h2>¿Quién es el dueño? <Ayuda termino="sri" /></h2><small>Gratis</small></div>
        <div className="panel-cuerpo pila" style={{ gap: 12 }}>
          <p className="tenue" style={{ margin: 0 }}>
            Busca el negocio en el registro del SRI. Si está a nombre de una persona, ese es el dueño.
          </p>
          <DuenoSri
            n={n}
            textoUsar="Guardar como dueño"
            alUsar={async (nombre, cand) => {
              const l = await asegurarLead(n.id);
              const linea = `Dueño según SRI: ${nombre} (RUC ${cand.ruc})`;
              await actualizarLead(n.id, {
                notas: l.notas.includes(linea) ? l.notas : [l.notas, linea].filter(Boolean).join('\n'),
                // No pisa un contacto ya verificado con Treg.
                ...(l.contacto && l.contacto.proveedor !== 'SRI'
                  ? {}
                  : { contacto: { nombre, cargo: 'Dueño (SRI)', email: null, verificacion: 'unknown' as const, proveedor: 'SRI', fecha: new Date().toISOString(), callId: cand.ruc, costoUsd: 0 } }),
              });
              avisar(`Guardado: ${nombre} es el dueño`);
            }}
          />
        </div>
      </section>

      <div className="pila">
        <section className="panel">
          <div className="panel-cab"><h2>Contacto guardado</h2></div>
          <div className="panel-cuerpo">
            {c ? (
              <div className="pila" style={{ gap: 4 }}>
                <strong style={{ fontSize: 15 }}>{c.nombre}</strong>
                <span className="tenue">{c.cargo} · fuente: {c.proveedor}</span>
                {c.email ? (
                  <span>
                    <a href={`mailto:${c.email}`}>{c.email}</a>{' '}
                    <span className={`etiqueta ${c.verificacion === 'valid' ? 'verde' : 'ambar'}`}>{c.verificacion === 'valid' ? 'Verificado' : 'Sin verificar'}</span>
                  </span>
                ) : <span className="muy-tenue">Sin correo todavía</span>}
              </div>
            ) : (
              <p className="tenue" style={{ margin: 0 }}>Aún no sabes quién decide. Búscalo en el SRI (a la izquierda).</p>
            )}
            {analisis?.gemini?.correos.length ? (
              <p style={{ margin: '12px 0 0' }} className="tenue">
                Correos que aparecen en su web: {analisis.gemini.correos.map((x) => <a key={x} href={`mailto:${x}`} style={{ marginRight: 8 }}>{x}</a>)}
              </p>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-cab"><h2>¿Necesitas su correo directo? <Ayuda termino="treg" /></h2><small>De pago</small></div>
          <div className="panel-cuerpo pila" style={{ gap: 10 }}>
            {conWeb ? (
              <>
                <p className="tenue" style={{ margin: 0 }}>
                  Treg busca el correo de trabajo de una persona en <strong>{n.web?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')}</strong>. Cuesta centavos por consulta.
                </p>
                <Link className="boton" to={`/inteligencia?negocio=${encodeURIComponent(n.id)}`} style={{ alignSelf: 'flex-start' }}>
                  <Icono nombre="persona" tam={15} /> Buscar correo con Treg
                </Link>
              </>
            ) : (
              <p className="tenue" style={{ margin: 0 }}>
                Treg necesita la web propia de la empresa y este negocio no la tiene. Llámalo o escríbele por WhatsApp con el nombre del dueño.
              </p>
            )}
          </div>
        </section>
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
            <div className="destacado-caja">
              <strong>Qué le ofrecería: {SERVICIOS[g.servicio.tipo] ?? g.servicio.tipo}.</strong> {g.servicio.porque}
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
        {!lead && <button className="pequeno" onClick={async () => { await asegurarLead(n.id); avisar('Guardado en Mis leads'); }}>Guardar en mis leads</button>}
      </div>
      <div className="panel-cuerpo pila" style={{ gap: 10 }}>
        <div className="pila" style={{ gap: 6 }}>
          <small className="tenue">Registra lo que hiciste (pone el estado y una próxima acción):</small>
          <div className="fila">
            {[
              { texto: '📞 Lo llamé', nota: 'Llamada', estado: 'contactado' as const, dias: 3 },
              { texto: '💬 Le escribí por WhatsApp', nota: 'WhatsApp enviado', estado: 'contactado' as const, dias: 3 },
              { texto: '✉️ Le mandé correo', nota: 'Correo enviado', estado: 'contactado' as const, dias: 4 },
              { texto: '↩️ Me respondió', nota: 'Respondió', estado: 'respondio' as const, dias: 1 },
              { texto: '📅 Agendamos reunión', nota: 'Reunión agendada', estado: 'reunion' as const, dias: 0 },
            ].map((x) => (
              <button
                key={x.texto}
                type="button"
                className="pequeno"
                onClick={async () => {
                  const l = await asegurarLead(n.id);
                  const fecha = new Date().toLocaleDateString('es-419', { day: '2-digit', month: 'short' });
                  const linea = `${fecha}: ${x.nota}`;
                  await actualizarLead(n.id, {
                    estado: x.estado,
                    proximaAccion: x.dias ? enDias(x.dias) : l.proximaAccion,
                    notas: [l.notas, linea].filter(Boolean).join('\n'),
                  });
                  setGuardado(true);
                  avisar(x.dias ? `Anotado. Próxima acción: en ${x.dias} día(s).` : 'Anotado. Pon la fecha de la reunión en «Próxima acción».');
                }}
              >
                {x.texto}
              </button>
            ))}
          </div>
        </div>
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
