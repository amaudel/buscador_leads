import { Link } from 'react-router-dom';
import { useCola, type Fase } from '../estado/analisis';

const TEXTO: Record<Fase, string> = {
  en_cola: 'En cola',
  pagespeed: 'PageSpeed…',
  gemini: 'Gemini…',
  hecho: 'Listo',
  error: 'Error',
};

export function ColaPanel() {
  const { items, orden, limpiar, reintentarFallidos } = useCola();
  if (!orden.length) return null;
  const lista = orden.map((id) => items[id]);
  const terminados = lista.filter((i) => i.fase === 'hecho' || i.fase === 'error').length;
  const activos = lista.length - terminados;
  const fallidos = lista.filter((i) => i.fase === 'error').length;
  return (
    <aside className="cola no-imprimir" aria-live="polite">
      <div className="cab pila" style={{ gap: 6 }}>
        <div className="fila entre">
          <strong>{activos ? `Analizando ${Math.min(terminados + 1, lista.length)} de ${lista.length}…` : `Análisis terminado (${lista.length})`}</strong>
          {!activos && (
            <span className="fila" style={{ gap: 4 }}>
              {fallidos > 0 && (
                <button className="pequeno primario" onClick={reintentarFallidos}>Reintentar {fallidos}</button>
              )}
              <button className="pequeno fantasma" onClick={limpiar}>Cerrar</button>
            </span>
          )}
        </div>
        <div className="barra"><span style={{ width: `${(terminados / lista.length) * 100}%` }} /></div>
        <small>Máximo dos webs a la vez · 10–30 s por web</small>
      </div>
      <ul>
        {lista.map((i) => (
          <li key={i.id}>
            {['pagespeed', 'gemini'].includes(i.fase) ? <span className="girando" /> : <span className={i.fase === 'error' ? 'c-rojo' : i.fase === 'hecho' ? 'c-verde' : 'muy-tenue'}>{i.fase === 'hecho' ? '✓' : i.fase === 'error' ? '✕' : '•'}</span>}
            <div style={{ minWidth: 0 }}>
              <Link to={`/negocio/${i.id}`}>{i.nombre}</Link> <span className="tenue">· {TEXTO[i.fase]}</span>
              {i.error && <div className="err">{i.error}</div>}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
