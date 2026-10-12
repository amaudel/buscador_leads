import { Link } from 'react-router-dom';
import type { Analisis, Lead, Negocio } from '../../shared/tipos';
import { puntuar } from '../logica/puntuacion';
import { telefonoEnlace } from '../logica/texto';
import { EstadoBadge, EtiquetaWeb, Icono, Oportunidad } from './ui';

export interface FilaNegocio {
  n: Negocio;
  lead?: Lead;
  analisis?: Analisis;
}

function Valoracion({ n }: { n: Negocio }) {
  if (n.valoracion == null) return <span className="muy-tenue">Sin valoraciones</span>;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--menu-activo)' }}>★</span> {n.valoracion.toFixed(1)}{' '}
      <span className="tenue">({n.numResenas})</span>
    </span>
  );
}

function Telefono({ n }: { n: Negocio }) {
  const href = telefonoEnlace(n);
  if (!href) return <span className="muy-tenue">—</span>;
  return (
    <a href={href} style={{ whiteSpace: 'nowrap' }}>
      {n.telNacional ?? n.telInternacional}
    </a>
  );
}

function Cerrado({ n }: { n: Negocio }) {
  if (!n.estadoNegocio || n.estadoNegocio === 'OPERATIONAL') return null;
  return (
    <span className="etiqueta rojo" style={{ marginLeft: 6 }}>
      {n.estadoNegocio === 'CLOSED_PERMANENTLY' ? 'Cerrado' : 'Cerrado temp.'}
    </span>
  );
}

interface Props {
  filas: FilaNegocio[];
  seleccion: string[];
  alternar: (id: string) => void;
  alternarTodos: () => void;
}

export function TablaNegocios({ filas, seleccion, alternar, alternarTodos }: Props) {
  const todos = filas.length > 0 && filas.every((f) => seleccion.includes(f.n.id));
  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            <th className="col-check">
              <input type="checkbox" checked={todos} onChange={alternarTodos} aria-label="Seleccionar todos" />
            </th>
            <th>Negocio</th>
            <th>Dirección</th>
            <th>Teléfono</th>
            <th>Web</th>
            <th>Valoración</th>
            <th>Maps</th>
            <th title="Puntuación de oportunidad (pulsa para ver el desglose)">Oport.</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ n, lead, analisis }) => (
            <tr key={n.id} className={seleccion.includes(n.id) ? 'seleccionada' : ''}>
              <td className="col-check">
                <input type="checkbox" checked={seleccion.includes(n.id)} onChange={() => alternar(n.id)} aria-label={`Seleccionar ${n.nombre}`} />
              </td>
              <td style={{ minWidth: 180 }}>
                <Link to={`/negocio/${n.id}`} className="nombre">{n.nombre}</Link>
                <Cerrado n={n} />
                <div className="tenue" style={{ fontSize: 12 }}>{n.dedicacion ?? n.nicho}</div>
              </td>
              <td><span className="recortar tenue" title={n.direccion ?? ''}>{n.direccion ?? '—'}</span></td>
              <td><Telefono n={n} /></td>
              <td><EtiquetaWeb n={n} /></td>
              <td><Valoracion n={n} /></td>
              <td>
                {n.mapsUrl ? (
                  <a href={n.mapsUrl} target="_blank" rel="noopener noreferrer" title="Abrir en Google Maps" aria-label="Abrir en Google Maps">
                    <Icono nombre="mapa" />
                  </a>
                ) : '—'}
              </td>
              <td><Oportunidad p={puntuar(n, analisis)} /></td>
              <td><EstadoBadge estado={lead?.estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TarjetasNegocios({ filas, seleccion, alternar }: Props) {
  return (
    <div className="tarjetas">
      {filas.map(({ n, lead, analisis }) => (
        <article key={n.id} className={`panel tarjeta ${seleccion.includes(n.id) ? 'seleccionada' : ''}`}>
          <div className="cab">
            <label className="check" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={seleccion.includes(n.id)} onChange={() => alternar(n.id)} aria-label={`Seleccionar ${n.nombre}`} />
              <span>
                <Link to={`/negocio/${n.id}`} style={{ fontWeight: 600, color: 'var(--texto)' }}>{n.nombre}</Link>
                <Cerrado n={n} />
                <div className="tenue" style={{ fontSize: 12 }}>{n.dedicacion ?? n.nicho}</div>
              </span>
            </label>
            <Oportunidad p={puntuar(n, analisis)} />
          </div>
          <div className="meta">
            <span>{n.direccion ?? '—'}</span>
            <span className="fila" style={{ gap: 12 }}>
              <Telefono n={n} />
              <Valoracion n={n} />
            </span>
            <EtiquetaWeb n={n} />
          </div>
          <div className="fila entre">
            <EstadoBadge estado={lead?.estado} />
            <span className="fila" style={{ gap: 4 }}>
              {telefonoEnlace(n) && (
                <a className="boton pequeno" href={telefonoEnlace(n)!}><Icono nombre="tel" tam={14} /> Llamar</a>
              )}
              {n.mapsUrl && (
                <a className="boton pequeno" href={n.mapsUrl} target="_blank" rel="noopener noreferrer"><Icono nombre="mapa" tam={14} /> Maps</a>
              )}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
