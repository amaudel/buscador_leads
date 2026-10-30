import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Negocio } from '../../shared/tipos';
import { api } from '../api/cliente';
import { repo } from '../datos';
import { useAjustes, usoDelMes, type Tema } from '../datos/ajustes';
import { useDatos } from '../estado/useDatos';
import { normalizar } from '../logica/texto';
import { ColaPanel } from './ColaPanel';
import { Toasts } from './Toast';
import { Avatar, Icono } from './ui';

const VISTAS = [
  { estado: 'analizado', texto: 'Por contactar' },
  { estado: 'contactado', texto: 'Contactados' },
  { estado: 'reunion', texto: 'Reuniones' },
  { estado: 'cliente', texto: 'Clientes' },
];

const SIGUIENTE_TEMA: Record<Tema, Tema> = { oscuro: 'claro', claro: 'sistema', sistema: 'oscuro' };
const NOMBRE_TEMA: Record<Tema, string> = { oscuro: 'Tema oscuro', claro: 'Tema claro', sistema: 'Tema del sistema' };

export function Layout() {
  const a = useAjustes();
  const uso = usoDelMes(a);
  const pct = Math.min(100, (uso / a.limiteMensual) * 100);
  const ruta = useLocation();
  const [faltan, setFaltan] = useState<string[]>([]);
  useEffect(() => {
    api
      .estado()
      .then((e) => setFaltan([!e.gemini && 'Gemini', !e.google && 'Google Cloud'].filter(Boolean) as string[]))
      .catch(() => setFaltan([]));
  }, [a.claveGemini, a.claveGoogle]);

  const { datos: leads } = useDatos(() => repo.listarLeads(), []);
  const cuenta = (estado: string) => leads?.filter((l) => l.estado === estado).length ?? 0;
  const vistaActiva = ruta.pathname === '/leads' ? new URLSearchParams(ruta.search).get('estado') : null;

  return (
    <div className="app">
      <nav className="menu" aria-label="Principal">
        <div className="marca">
          <span className="logo"><Icono nombre="radar" tam={17} /></span>
          <span>
            Radar de Clientes
            <small>Prospección local</small>
          </span>
        </div>
        <NavLink to="/" end><Icono nombre="inicio" tam={17} />Inicio</NavLink>

        <div className="seccion solo-escritorio">1 · Encontrar</div>
        <NavLink to="/buscar"><Icono nombre="buscar" tam={17} />Buscar</NavLink>
        <NavLink to="/radar" className={({ isActive }) => `solo-escritorio ${isActive ? 'active' : ''}`}><Icono nombre="radar" tam={17} />Radar de nichos</NavLink>

        <div className="seccion solo-escritorio">2 · Trabajar</div>
        <NavLink to="/leads" className={({ isActive }) => (isActive && !vistaActiva ? 'active' : '')}>
          <Icono nombre="leads" tam={17} />Mis leads
          {leads ? <span className="contador">{leads.length}</span> : null}
        </NavLink>
        <NavLink to="/inteligencia"><Icono nombre="persona" tam={17} /><span className="solo-escritorio">Inteligencia B2B</span><span className="solo-movil">Contactos</span></NavLink>

        <div className="seccion solo-escritorio">Mis leads por estado</div>
        {VISTAS.map((v) => (
          <Link key={v.estado} to={`/leads?estado=${v.estado}`} className={`solo-escritorio ${vistaActiva === v.estado ? 'active' : ''}`}>
            <Icono nombre="punto" tam={17} />
            {v.texto}
            <span className="contador">{cuenta(v.estado)}</span>
          </Link>
        ))}

        <div className="pie">
          <NavLink to="/ajustes"><Icono nombre="ajustes" tam={17} />Ajustes</NavLink>
          <a
            href="#tema"
            className="solo-escritorio"
            onClick={(e) => {
              e.preventDefault();
              a.cambiar({ tema: SIGUIENTE_TEMA[a.tema] });
            }}
            title="Cambiar tema"
          >
            <Icono nombre={a.tema === 'claro' ? 'sol' : 'luna'} tam={17} />
            {NOMBRE_TEMA[a.tema]}
          </a>
          <div className="uso">
            Places este mes: {uso} / {a.limiteMensual}
            <div className={`barra ${uso >= a.limiteMensual ? 'rojo' : uso >= a.umbralAviso ? 'ambar' : ''}`}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </nav>

      <div className="contenido">
        <header className="barra-superior no-imprimir">
          <BusquedaRapida />
          <Link to="/buscar" className="boton primario">
            <Icono nombre="mas" tam={15} /> <span className="solo-escritorio">Nueva búsqueda</span>
          </Link>
        </header>
        <main className="principal">
          {faltan.length > 0 && ruta.pathname !== '/ajustes' && (
            <div className="aviso-caja" style={{ marginBottom: 14 }}>
              Falta la clave de {faltan.join(' y ')}. <Link to="/ajustes">Pégala en Ajustes</Link> para poder buscar y analizar.
            </div>
          )}
          {uso >= a.umbralAviso && (
            <div className="aviso-caja" style={{ marginBottom: 14 }}>
              Llevas {uso} llamadas a Places este mes (aviso a partir de {a.umbralAviso}, límite {a.limiteMensual}). Las
              búsquedas en caché no gastan llamadas.
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <ColaPanel />
      <Toasts />
    </div>
  );
}

/** Búsqueda rápida entre los negocios ya vistos o guardados. */
function BusquedaRapida() {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { datos: negocios } = useDatos(() => repo.listarNegocios(), []);

  const resultados = useMemo<Negocio[]>(() => {
    const q = normalizar(texto);
    if (!q || !negocios) return [];
    return negocios
      .filter((n) => normalizar(`${n.nombre} ${n.dedicacion ?? ''} ${n.direccion ?? ''} ${n.telNacional ?? ''}`).includes(q))
      .slice(0, 8);
  }, [texto, negocios]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const ir = (n: Negocio) => {
    navegar(`/negocio/${n.id}`);
    setTexto('');
    setAbierto(false);
  };

  return (
    <div className="busqueda-rapida" ref={ref}>
      <Icono nombre="buscar" tam={15} />
      <input
        type="search"
        placeholder="Búsqueda rápida de negocios…"
        aria-label="Búsqueda rápida de negocios"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          setActivo(0);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActivo((i) => Math.min(i + 1, resultados.length - 1));
          if (e.key === 'ArrowUp') setActivo((i) => Math.max(i - 1, 0));
          if (e.key === 'Enter' && resultados[activo]) ir(resultados[activo]);
          if (e.key === 'Escape') setAbierto(false);
        }}
      />
      {abierto && texto.trim() && (
        <div className="resultados" role="listbox">
          {resultados.length === 0 ? (
            <div className="muy-tenue" style={{ padding: '8px 10px' }}>Ningún negocio guardado coincide</div>
          ) : (
            resultados.map((n, i) => (
              <a
                key={n.id}
                href={`/negocio/${n.id}`}
                className={i === activo ? 'activo' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  ir(n);
                }}
              >
                <Avatar nombre={n.nombre} />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ fontWeight: 600 }}>{n.nombre}</strong>
                  <div className="sub">{n.dedicacion ?? n.nicho} · {n.zona}</div>
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
