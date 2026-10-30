import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Lead, Negocio } from '../../shared/tipos';
import { api } from '../api/cliente';
import { Ayuda } from '../componentes/Ayuda';
import { Avatar, EstadoBadge } from '../componentes/ui';
import { repo } from '../datos';
import { useAjustes } from '../datos/ajustes';
import { useDatos } from '../estado/useDatos';
import { hoyIso, siguientePaso } from '../logica/pasos';
import { fechaCorta } from '../logica/texto';

const PROCESO = [
  { n: 1, titulo: 'Buscar', texto: 'Escribe zona y tipo de negocio. Ves quién no tiene web.', a: '/buscar' },
  { n: 2, titulo: 'Guardar', texto: 'Guarda los que te interesan en tus leads.', a: '/buscar' },
  { n: 3, titulo: 'Analizar', texto: 'La app revisa su web y te dice qué le falta.', a: '/leads?estado=nuevo' },
  { n: 4, titulo: 'Dueño', texto: 'Averigua quién decide (SRI gratis o Treg).', a: '/leads?estado=analizado' },
  { n: 5, titulo: 'Mensaje', texto: 'La app te redacta llamada, WhatsApp y correo.', a: '/leads?estado=analizado' },
  { n: 6, titulo: 'Seguimiento', texto: 'Marca el estado y la próxima acción.', a: '/leads' },
];

interface Fila {
  n: Negocio;
  l: Lead;
}

export function Inicio() {
  const a = useAjustes();
  const [claves, setClaves] = useState<{ gemini: boolean; google: boolean } | null>(null);
  useEffect(() => {
    api.estado().then((e) => setClaves({ gemini: e.gemini, google: e.google })).catch(() => setClaves(null));
  }, [a.claveGemini, a.claveGoogle]);

  const { datos } = useDatos(async () => {
    const [leads, negocios, analisis, borradores] = await Promise.all([repo.listarLeads(), repo.listarNegocios(), repo.listarAnalisis(), repo.listarBorradores()]);
    const mb = new Map(borradores.map((x) => [x.negocioId, x]));
    const mn = new Map(negocios.map((n) => [n.id, n]));
    const ma = new Map(analisis.map((x) => [x.negocioId, x]));
    const filas: (Fila & { sig: ReturnType<typeof siguientePaso> })[] = leads
      .filter((l) => mn.has(l.negocioId))
      .map((l) => ({ l, n: mn.get(l.negocioId)!, sig: siguientePaso(l, ma.get(l.negocioId), mb.get(l.negocioId)) }));
    return { filas, vistos: negocios.length };
  }, []);

  const filas = datos?.filas ?? [];
  const hoy = hoyIso();
  const paraHoy = filas.filter((f) => f.l.proximaAccion && f.l.proximaAccion <= hoy && !['cliente', 'descartado'].includes(f.l.estado))
    .sort((x, y) => (x.l.proximaAccion ?? '').localeCompare(y.l.proximaAccion ?? ''));
  const porContactar = filas.filter((f) => f.l.estado === 'analizado');
  const sinAnalizar = filas.filter((f) => f.l.estado === 'nuevo');

  const pasosInicio = [
    { hecho: Boolean(claves?.gemini && claves?.google), texto: 'Pega tus claves de Google y Gemini', a: '/ajustes' },
    { hecho: a.regionCode !== 'ES', texto: 'Elige tu país (Ecuador = EC)', a: '/ajustes' },
    { hecho: Boolean(a.perfil.nombre), texto: 'Completa tu perfil de vendedor (para los mensajes)', a: '/ajustes' },
    { hecho: (datos?.vistos ?? 0) > 0, texto: 'Haz tu primera búsqueda', a: '/buscar' },
    { hecho: filas.length > 0, texto: 'Guarda tu primer lead', a: '/buscar' },
  ];
  const faltan = pasosInicio.filter((p) => !p.hecho).length;

  return (
    <div className="pila">
      <div className="cabecera">
        <div>
          <h1>Hola{a.perfil.nombre ? `, ${a.perfil.nombre.split(' ')[0]}` : ''} 👋</h1>
          <p>Encuentra negocios que necesitan lo que vendes, averigua quién decide y escríbele con un mensaje hecho a su medida.</p>
        </div>
      </div>

      {faltan > 0 && (
        <section className="panel">
          <div className="panel-cab">
            <h2>Para empezar ({pasosInicio.length - faltan} de {pasosInicio.length})</h2>
            <small>Se marca solo a medida que avanzas</small>
          </div>
          <div className="panel-cuerpo">
            <ul className="checklist-inicio">
              {pasosInicio.map((p) => (
                <li key={p.texto} className={p.hecho ? 'hecho' : ''}>
                  <span className="marca-check">✓</span>
                  <span className="texto" style={{ flex: 1 }}>{p.texto}</span>
                  {!p.hecho && <Link to={p.a} className="boton pequeno">Ir</Link>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="pila" style={{ gap: 10 }}>
        <h3>Cómo funciona</h3>
        <div className="proceso">
          {PROCESO.map((p) => (
            <Link key={p.n} to={p.a}>
              <span className="num">{p.n}</span>
              <strong>{p.titulo}</strong>
              <small className="tenue">{p.texto}</small>
            </Link>
          ))}
        </div>
      </section>

      <div className="cifras">
        <div className="cifra"><strong>{filas.length}</strong><span>leads guardados</span></div>
        <div className="cifra"><strong>{sinAnalizar.length}</strong><span>sin analizar</span></div>
        <div className="cifra"><strong>{porContactar.length}</strong><span>por contactar</span></div>
        <div className="cifra"><strong>{filas.filter((f) => ['contactado', 'respondio', 'reunion'].includes(f.l.estado)).length}</strong><span>en conversación</span></div>
        <div className="cifra"><strong>{filas.filter((f) => f.l.estado === 'cliente').length}</strong><span>clientes</span></div>
      </div>

      <div className="rejilla-2">
        <ListaDia
          titulo="Para hoy"
          ayuda="Leads con la próxima acción para hoy o atrasada."
          vacio="Nada pendiente para hoy. Pon fecha de próxima acción en el seguimiento de cada lead."
          filas={paraHoy}
          detalle={(f) => `Próxima acción: ${fechaCorta(f.l.proximaAccion)}`}
        />
        <ListaDia
          titulo="Listos para contactar"
          ayuda="Ya analizados: busca al dueño, prepara el mensaje y contáctalos."
          vacio="Analiza tus leads para que aparezcan aquí."
          filas={porContactar}
          verTodos="/leads?estado=analizado"
        />
        <ListaDia
          titulo="Sin analizar"
          ayuda="Guardados pero aún sin revisar su web."
          vacio="Todos tus leads están analizados."
          filas={sinAnalizar}
          verTodos="/leads?estado=nuevo"
        />
        <section className="panel">
          <div className="panel-cab"><h2>Palabras que verás</h2></div>
          <div className="panel-cuerpo pila" style={{ gap: 8, fontSize: 13 }}>
            <div>Oportunidad <Ayuda termino="oportunidad" /> · PageSpeed <Ayuda termino="pagespeed" /> · Web propia <Ayuda termino="webPropia" /></div>
            <div>SRI <Ayuda termino="sri" /> · Persona natural <Ayuda termino="personaNatural" /> · Treg <Ayuda termino="treg" /></div>
            <small className="muy-tenue">Toca el «?» para ver qué significa.</small>
          </div>
        </section>
      </div>
    </div>
  );
}

function ListaDia({ titulo, ayuda, vacio, filas, detalle, verTodos }: {
  titulo: string;
  ayuda: string;
  vacio: string;
  filas: (Fila & { sig: ReturnType<typeof siguientePaso> })[];
  detalle?: (f: Fila) => string;
  verTodos?: string;
}) {
  return (
    <section className="panel">
      <div className="panel-cab">
        <h2>{titulo} <span className="muy-tenue" style={{ fontWeight: 400 }}>({filas.length})</span> <Ayuda texto={ayuda} /></h2>
        {verTodos && filas.length > 5 && <Link to={verTodos} className="pequeno">Ver todos</Link>}
      </div>
      <div className="panel-cuerpo" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {filas.length === 0 ? (
          <p className="tenue" style={{ margin: '10px 0' }}>{vacio}</p>
        ) : (
          <ul className="lista-dia">
            {filas.slice(0, 5).map((f) => (
              <li key={f.n.id}>
                <Avatar nombre={f.n.nombre} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/negocio/${f.n.id}`} style={{ fontWeight: 600, color: 'var(--texto)' }}>{f.n.nombre}</Link>
                  <div className="sub">{detalle ? detalle(f) : f.n.dedicacion ?? f.n.nicho}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <EstadoBadge estado={f.l.estado} />
                  <div><Link to={`/negocio/${f.n.id}?paso=${f.sig.paso}`} className="chip-siguiente">{f.sig.corto}</Link></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
