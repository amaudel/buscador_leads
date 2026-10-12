import { NavLink, Outlet } from 'react-router-dom';
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
