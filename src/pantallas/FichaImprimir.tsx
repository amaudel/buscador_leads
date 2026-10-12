import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ESTADOS, SERVICIOS } from '../../shared/tipos';
import { repo } from '../datos';
import { useDatos } from '../estado/useDatos';
import { etiquetaWeb } from '../logica/clasificarWeb';
import { puntuar } from '../logica/puntuacion';
import { fechaCorta } from '../logica/texto';
import { AVISO_BORRADORES } from './Ficha';

const CHECKS = [
  ['https', 'HTTPS', 'no'], ['adaptadaMovil', 'Adaptada a móvil', 'no'], ['botonWhatsapp', 'Botón de WhatsApp', 'no'],
  ['citaOnline', 'Cita o reserva online', 'no'], ['formularioContacto', 'Formulario de contacto', 'no'],
  ['desactualizada', 'Señales de web desactualizada', 'si'],
] as const;

/** Versión imprimible de la ficha (Imprimir → Guardar como PDF). */
export function FichaImprimir() {
  const { id = '' } = useParams();
  const { datos, cargando } = useDatos(async () => {
    const [n, lead, a, b] = await Promise.all([repo.obtenerNegocio(id), repo.obtenerLead(id), repo.obtenerAnalisis(id), repo.obtenerBorradores(id)]);
    return { n, lead, a, b };
  }, [id]);

  useEffect(() => {
    if (!datos?.n) return;
    document.title = `Ficha — ${datos.n.nombre}`;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [datos?.n]);

  if (cargando) return <p className="impresion">Cargando…</p>;
  if (!datos?.n) return <p className="impresion">No se encontró el negocio.</p>;
  const { n, lead, a, b } = datos;
  const p = puntuar(n, a);
  const g = a?.gemini;
  const ps = a?.pagespeed;

  return (
    <div className="impresion">
      <div className="no-imprimir" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button className="primario" onClick={() => window.print()}>Imprimir / Guardar como PDF</button>
        <button onClick={() => window.close()}>Cerrar</button>
      </div>
      <h1>{n.nombre}</h1>
      <div style={{ color: '#555' }}>{n.dedicacion ?? n.nicho} · {n.zona} · Ficha generada el {fechaCorta(new Date().toISOString())}</div>

      <section>
        <h2>Contacto</h2>
        <table className="desglose">
          <tbody>
            <tr><td>Teléfono</td><td>{n.telNacional ?? '—'} {n.telInternacional ? `(${n.telInternacional})` : ''}</td></tr>
            <tr><td>Web</td><td>{n.tipoWeb === 'propia' ? n.web : `${etiquetaWeb(n.tipoWeb)}${n.web ? ` — ${n.web}` : ''}`}</td></tr>
            <tr><td>Dirección</td><td>{n.direccion ?? '—'}</td></tr>
            <tr><td>Valoración</td><td>{n.valoracion != null ? `${n.valoracion.toFixed(1)} ★ (${n.numResenas} reseñas)` : '—'}</td></tr>
            <tr><td>Google Maps</td><td>{n.mapsUrl ?? '—'}</td></tr>
            {g?.correos.length ? <tr><td>Correos</td><td>{g.correos.join(', ')}</td></tr> : null}
            {g?.redes.length ? <tr><td>Redes</td><td>{g.redes.map((r) => `${r.red}: ${r.url}`).join(' · ')}</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Oportunidad: {p.total}/100 {p.provisional ? '(provisional)' : ''} {p.etiqueta === 'Sin web' ? '— Sin web' : ''}</h2>
        <table className="desglose">
          <tbody>{p.desglose.map((d, i) => <tr key={i}><td>{d.motivo}</td><td>{i === 0 || d.puntos <= 0 ? d.puntos : `+${d.puntos}`}</td></tr>)}</tbody>
        </table>
      </section>

      {ps && (
        <section>
          <h2>PageSpeed en móvil</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <table className="desglose" style={{ flex: 1 }}>
              <tbody>
                <tr><td>Rendimiento</td><td>{ps.notas.performance ?? '—'}</td></tr>
                <tr><td>SEO</td><td>{ps.notas.seo ?? '—'}</td></tr>
                <tr><td>Accesibilidad</td><td>{ps.notas.accessibility ?? '—'}</td></tr>
                <tr><td>Buenas prácticas</td><td>{ps.notas.bestPractices ?? '—'}</td></tr>
                {ps.auditorias.filter((x) => x.valor).map((x) => <tr key={x.id}><td>{x.titulo}</td><td>{x.valor}</td></tr>)}
              </tbody>
            </table>
            {ps.captura && <img src={ps.captura} alt="Captura" style={{ width: 170, border: '1px solid #ccc', borderRadius: 8 }} />}
          </div>
        </section>
      )}

      {g && (
        <section>
          <h2>Análisis</h2>
          <p>{g.resumen}</p>
          {g.checklist && (
            <table className="desglose">
              <tbody>
                {CHECKS.map(([k, t, malo]) => {
                  const c = g.checklist![k];
                  return <tr key={k}><td><strong>{c.estado === 'desconocido' ? '?' : c.estado === malo ? '✕' : '✓'}</strong> {t}</td><td style={{ fontWeight: 400, textAlign: 'left' }}>{c.detalle}</td></tr>;
                })}
              </tbody>
            </table>
          )}
          <p><strong>Problemas:</strong></p>
          <ol>{g.problemas.map((x, i) => <li key={i}><strong>{x.titulo}.</strong> {x.explicacion}</li>)}</ol>
          <p><strong>Servicio recomendado: {SERVICIOS[g.servicio.tipo] ?? g.servicio.tipo}.</strong> {g.servicio.porque}</p>
        </section>
      )}

      {b && (
        <section>
          <h2>Primer contacto (tono {b.tono})</h2>
          <p style={{ fontStyle: 'italic' }}>{AVISO_BORRADORES}</p>
          <p><strong>Guion de llamada</strong></p>
          <pre>{b.llamada}</pre>
          <p><strong>WhatsApp</strong></p>
          <pre>{b.whatsapp}</pre>
          <p><strong>Correo</strong></p>
          <pre>Asunto: {b.correo.asunto}{'\n\n'}{b.correo.cuerpo}</pre>
        </section>
      )}

      <section>
        <h2>Seguimiento</h2>
        <table className="desglose">
          <tbody>
            <tr><td>Estado</td><td>{ESTADOS.find((e) => e.id === lead?.estado)?.etiqueta ?? 'No guardado'}</td></tr>
            <tr><td>Próxima acción</td><td>{fechaCorta(lead?.proximaAccion)}</td></tr>
          </tbody>
        </table>
        {lead?.notas && <pre>{lead.notas}</pre>}
      </section>
    </div>
  );
}
