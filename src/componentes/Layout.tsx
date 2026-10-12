import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api/cliente';
import { useAjustes, usoDelMes } from '../datos/ajustes';
import { ColaPanel } from './ColaPanel';
import { Icono } from './ui';

const ENTRADAS = [
  { a: '/buscar', texto: 'Buscar', icono: 'buscar' },
  { a: '/radar', texto: 'Radar de nichos', icono: 'radar' },
  { a: '/leads', texto: 'Mis leads', icono: 'leads' },
  { a: '/ajustes', texto: 'Ajustes', icono: 'ajustes' },
] as const;

export function Layout() {
  const a = useAjustes();
  const uso = usoDelMes(a);
  const pct = Math.min(100, (uso / a.limiteMensual) * 100);
  const ruta = useLocation().pathname;
  const [faltan, setFaltan] = useState<string[]>([]);
  useEffect(() => {
    api
      .estado()
      .then((e) => setFaltan([!e.gemini && 'Gemini', !e.google && 'Google Cloud'].filter(Boolean) as string[]))
      .catch(() => setFaltan([]));
  }, [a.claveGemini, a.claveGoogle]);
  return (
    <div className="app">
      <nav className="menu" aria-label="Principal">
        <div className="marca">
          <img src="/favicon.svg" alt="" /> Radar de Clientes
        </div>
        {ENTRADAS.map((e) => (
          <NavLink key={e.a} to={e.a}>
            <Icono nombre={e.icono} tam={18} />
            {e.texto}
          </NavLink>
        ))}
        <div className="pie">
          Places este mes: {uso} / {a.limiteMensual}
          <div className={`barra ${uso >= a.limiteMensual ? 'rojo' : uso >= a.umbralAviso ? 'ambar' : ''}`}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </nav>
      <main className="principal">
        {faltan.length > 0 && ruta !== '/ajustes' && (
          <div className="aviso-caja" style={{ marginBottom: 12 }}>
            Falta la clave de {faltan.join(' y ')}. <Link to="/ajustes">Pégala en Ajustes</Link> para poder buscar y analizar.
          </div>
        )}
        {uso >= a.umbralAviso && (
          <div className="aviso-caja" style={{ marginBottom: 12 }}>
            Llevas {uso} llamadas a Places este mes (aviso a partir de {a.umbralAviso}, límite {a.limiteMensual}). Las
            búsquedas en caché no gastan llamadas.
          </div>
        )}
        <Outlet />
      </main>
      <ColaPanel />
    </div>
  );
}
