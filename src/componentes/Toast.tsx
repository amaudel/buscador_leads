import { Link } from 'react-router-dom';
import { create } from 'zustand';

interface Toast {
  id: number;
  texto: string;
  tipo: 'ok' | 'error' | 'info';
  enlace?: { a: string; texto: string };
}

const useToasts = create<{ lista: Toast[] }>(() => ({ lista: [] }));
let siguienteId = 1;

/** Muestra un aviso breve abajo de la pantalla. */
export function avisar(texto: string, opciones: { tipo?: Toast['tipo']; enlace?: Toast['enlace']; ms?: number } = {}) {
  const t: Toast = { id: siguienteId++, texto, tipo: opciones.tipo ?? 'ok', enlace: opciones.enlace };
  useToasts.setState((s) => ({ lista: [...s.lista.slice(-2), t] }));
  setTimeout(() => useToasts.setState((s) => ({ lista: s.lista.filter((x) => x.id !== t.id) })), opciones.ms ?? 4500);
}

export function Toasts() {
  const lista = useToasts((s) => s.lista);
  if (!lista.length) return null;
  return (
    <div className="toasts no-imprimir" role="status" aria-live="polite">
      {lista.map((t) => (
        <div key={t.id} className={`toast ${t.tipo}`}>
          <span>{t.tipo === 'error' ? '✕' : t.tipo === 'ok' ? '✓' : 'ℹ'}</span>
          <span style={{ flex: 1 }}>{t.texto}</span>
          {t.enlace && <Link to={t.enlace.a}>{t.enlace.texto}</Link>}
        </div>
      ))}
    </div>
  );
}
