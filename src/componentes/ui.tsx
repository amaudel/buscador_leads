import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ESTADOS, type EstadoLead, type Negocio } from '../../shared/tipos';
import { etiquetaWeb } from '../logica/clasificarWeb';
import { colorNota, colorOportunidad, type Puntuacion } from '../logica/puntuacion';

const RUTAS_ICONO: Record<string, string> = {
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  radar: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l7-7',
  leads: 'M4 5h16M4 12h16M4 19h10',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.2-1.3L14.5 3h-5l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h5l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z',
  tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  web: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  mapa: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  imprimir: 'M7 9V3h10v6M7 18H4v-7h16v7h-3M7 14h10v7H7z',
  descargar: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  wa: 'M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1-1-2z',
  volver: 'M15 18l-6-6 6-6',
  inicio: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  check: 'M5 12l5 5 9-10',
  sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  luna: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  punto: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  mas: 'M12 5v14M5 12h14',
  chevron: 'M8 10l4 4 4-4',
};

export function Icono({ nombre, tam = 16 }: { nombre: keyof typeof RUTAS_ICONO; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={RUTAS_ICONO[nombre]} />
    </svg>
  );
}

/** Cuadro con las iniciales del negocio, como el icono de archivo de Papra. */
export function Avatar({ nombre }: { nombre: string }) {
  const iniciales = nombre
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((p) => p.length > 2 || /\d/.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return <span className="avatar" aria-hidden="true">{iniciales || nombre.slice(0, 2).toUpperCase()}</span>;
}

export function Nota({ valor, titulo }: { valor: number | null | undefined; titulo?: string }) {
  return (
    <span className={`nota ${colorNota(valor)}`} title={titulo}>
      {valor ?? '—'}
    </span>
  );
}

export function Anillo({ valor, etiqueta }: { valor: number | null; etiqueta: string }) {
  const c = colorNota(valor);
  const r = 26;
  const per = 2 * Math.PI * r;
  return (
    <div className="anillo">
      <svg viewBox="0 0 64 64" className={`c-${c}`}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--gris-suave)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${((valor ?? 0) / 100) * per} ${per}`} transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" className="valor" fill="currentColor" fontSize="17" fontWeight="700">
          {valor ?? '—'}
        </text>
      </svg>
      {etiqueta}
    </div>
  );
}

export function TablaDesglose({ p }: { p: Puntuacion }) {
  return (
    <table className="desglose">
      <tbody>
        {p.desglose.map((d, i) => (
          <tr key={i}>
            <td>{d.motivo}</td>
            <td className={d.puntos > 0 && i > 0 ? 'pos' : d.puntos < 0 ? 'neg' : ''}>
              {i === 0 ? d.puntos : d.puntos > 0 ? `+${d.puntos}` : d.puntos}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total {p.provisional ? '(provisional, solo datos de Maps)' : ''}</td>
          <td>{p.total}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** Puntuación de oportunidad con su desglose en un desplegable. */
export function Oportunidad({ p }: { p: Puntuacion }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);
  return (
    <span className="desglose-pop" ref={ref}>
      <button
        type="button"
        className={`nota ${colorOportunidad(p.total)} ${p.provisional ? 'provisional' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
        title={p.provisional ? 'Puntuación provisional: pulsa para ver el desglose' : 'Pulsa para ver el desglose'}
        aria-expanded={abierto}
      >
        {p.total}
      </button>
      {abierto && (
        <span className="pop" onClick={(e) => e.stopPropagation()}>
          <strong style={{ display: 'block', marginBottom: 6 }}>¿Por qué {p.total}?</strong>
          <TablaDesglose p={p} />
        </span>
      )}
    </span>
  );
}

export function EtiquetaWeb({ n, recortar = true }: { n: Negocio; recortar?: boolean }) {
  if (n.tipoWeb === 'propia' && n.web)
    return (
      <a href={n.web} target="_blank" rel="noopener noreferrer" className={recortar ? 'recortar' : ''} title={n.web}>
        {n.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
      </a>
    );
  return (
    <span className="fila" style={{ gap: 4 }}>
      <span className={`etiqueta ${n.tipoWeb === 'ninguna' ? 'rojo' : 'ambar'}`}>{etiquetaWeb(n.tipoWeb)}</span>
      {n.web && (
        <a href={n.web} target="_blank" rel="noopener noreferrer" className="muy-tenue recortar" style={{ maxWidth: 140, fontSize: 12 }} title={n.web}>
          {n.web.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      )}
    </span>
  );
}

const COLOR_ESTADO: Record<EstadoLead, string> = {
  nuevo: '', analizado: 'azul', contactado: 'ambar', respondio: 'violeta', reunion: 'acento', cliente: 'verde', descartado: 'rojo',
};

export function EstadoBadge({ estado }: { estado: EstadoLead | null | undefined }) {
  if (!estado) return <span className="muy-tenue" style={{ whiteSpace: 'nowrap' }}>No guardado</span>;
  return <span className={`etiqueta ${COLOR_ESTADO[estado]}`}>{ESTADOS.find((e) => e.id === estado)?.etiqueta}</span>;
}

export function SelectorEstado({ valor, alCambiar }: { valor: EstadoLead; alCambiar: (e: EstadoLead) => void }) {
  return (
    <select value={valor} onChange={(e) => alCambiar(e.target.value as EstadoLead)} aria-label="Estado">
      {ESTADOS.map((e) => (
        <option key={e.id} value={e.id}>{e.etiqueta}</option>
      ))}
    </select>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

export function ErrorCaja({ titulo = 'Algo falló', mensaje }: { titulo?: string; mensaje: string }) {
  return (
    <div className="error-caja" role="alert">
      <strong>{titulo}</strong>
      {mensaje}
    </div>
  );
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <span className="fila tenue">
      <span className="girando" /> {texto}
    </span>
  );
}

export function BotonCopiar({ texto, etiqueta = 'Copiar' }: { texto: string; etiqueta?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="pequeno"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
        } catch {
          const t = document.createElement('textarea');
          t.value = texto;
          document.body.appendChild(t);
          t.select();
          document.execCommand('copy');
          t.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      <Icono nombre="copiar" tam={14} /> {ok ? '¡Copiado!' : etiqueta}
    </button>
  );
}

export function Modal({ titulo, children, onCerrar }: { titulo: string; children: ReactNode; onCerrar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
