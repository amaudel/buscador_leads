import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ESTADOS, SERVICIOS, type Analisis, type EstadoLead, type Lead, type Negocio } from '../../shared/tipos';
import { Cargando, EtiquetaWeb, Icono, Oportunidad, SelectorEstado, Vacio } from '../componentes/ui';
import { repo } from '../datos';
import { useDatos } from '../estado/useDatos';
import { etiquetaWeb } from '../logica/clasificarWeb';
import { descargarCsv } from '../logica/csv';
import { actualizarLead } from '../logica/leads';
import { puntuar } from '../logica/puntuacion';
import { fechaCorta, normalizar, telefonoEnlace } from '../logica/texto';

interface Fila {
  lead: Lead;
  n: Negocio;
  a?: Analisis;
}

export function MisLeads() {
  const { datos, cargando } = useDatos(async () => {
    const leads = await repo.listarLeads();
    const [negocios, analisis] = await Promise.all([repo.listarNegocios(leads.map((l) => l.negocioId)), repo.listarAnalisis()]);
    const mn = new Map(negocios.map((n) => [n.id, n]));
    const ma = new Map(analisis.map((a) => [a.negocioId, a]));
    return leads
      .filter((l) => mn.has(l.negocioId))
      .map((lead) => ({ lead, n: mn.get(lead.negocioId)!, a: ma.get(lead.negocioId) }));
  }, []);

  const [vista, setVista] = useState<'tabla' | 'tablero'>('tabla');
  const [estado, setEstado] = useState('');
  const [nicho, setNicho] = useState('');
  const [zona, setZona] = useState('');
  const [texto, setTexto] = useState('');

  const todas = datos ?? [];
  const nichos = useMemo(() => [...new Set(todas.map((f) => f.n.nicho))].sort(), [todas]);
  const zonas = useMemo(() => [...new Set(todas.map((f) => f.n.zona))].sort(), [todas]);

  const filas = useMemo(() => {
    const q = normalizar(texto);
    return todas
      .filter((f) => (!estado || f.lead.estado === estado) && (!nicho || f.n.nicho === nicho) && (!zona || f.n.zona === zona))
      .filter((f) => !q || normalizar(`${f.n.nombre} ${f.n.direccion ?? ''} ${f.n.dedicacion ?? ''} ${f.lead.notas} ${f.n.telNacional ?? ''}`).includes(q))
      .sort((x, y) => y.lead.actualizado.localeCompare(x.lead.actualizado));
  }, [todas, estado, nicho, zona, texto]);

  const exportar = () =>
    descargarCsv(
      `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      filas.map(({ n, lead, a }) => {
        const p = puntuar(n, a);
        return {
          Nombre: n.nombre,
          Categoría: n.dedicacion ?? '',
          Nicho: n.nicho,
          Zona: n.zona,
          Dirección: n.direccion ?? '',
          Teléfono: n.telNacional ?? '',
          'Teléfono internacional': n.telInternacional ?? '',
          Web: n.web ?? '',
          'Tipo de web': etiquetaWeb(n.tipoWeb),
          Valoración: n.valoracion ?? '',
          Reseñas: n.numResenas,
          'Google Maps': n.mapsUrl ?? '',
          Oportunidad: p.total,
          'Oportunidad provisional': p.provisional ? 'Sí' : 'No',
          'PageSpeed rendimiento': a?.pagespeed?.notas.performance ?? '',
          'PageSpeed SEO': a?.pagespeed?.notas.seo ?? '',
          'Servicio recomendado': a?.gemini ? SERVICIOS[a.gemini.servicio.tipo] : '',
          Correos: a?.gemini?.correos.join(', ') ?? '',
          Estado: ESTADOS.find((e) => e.id === lead.estado)?.etiqueta ?? lead.estado,
          'Próxima acción': lead.proximaAccion ?? '',
          Notas: lead.notas,
          'Guardado el': lead.creado.slice(0, 10),
        };
      }),
    );

  return (
    <div className="pila">
      <div className="cabecera">
        <div>
          <h1>Mis leads</h1>
          <p>{todas.length} negocios guardados. Arrastra entre columnas en el tablero para cambiar el estado.</p>
        </div>
        <div className="fila">
          <div className="segmentado" role="group" aria-label="Vista">
            <button aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>Tabla</button>
            <button aria-pressed={vista === 'tablero'} onClick={() => setVista('tablero')}>Tablero</button>
          </div>
          <button onClick={exportar} disabled={!filas.length}><Icono nombre="descargar" tam={15} /> Exportar CSV</button>
        </div>
      </div>

      <div className="panel panel-cuerpo fila" style={{ gap: 10 }}>
        <input type="search" placeholder="Buscar por nombre, dirección, notas…" value={texto} onChange={(e) => setTexto(e.target.value)} style={{ flex: '1 1 220px' }} aria-label="Buscar" />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
        </select>
        <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Filtrar por nicho">
          <option value="">Todos los nichos</option>
          {nichos.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={zona} onChange={(e) => setZona(e.target.value)} aria-label="Filtrar por zona">
          <option value="">Todas las zonas</option>
          {zonas.map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>

      {cargando ? (
        <Cargando texto="Cargando leads…" />
      ) : !todas.length ? (
        <div className="panel">
          <Vacio titulo="Aún no tienes leads guardados">
            Busca negocios en <Link to="/buscar">Buscar</Link>, selecciónalos y pulsa «Guardar en mis leads».
          </Vacio>
        </div>
      ) : vista === 'tabla' ? (
        <div className="panel">
          {!filas.length ? <Vacio titulo="Ningún lead cumple los filtros" /> : <TablaLeads filas={filas} />}
        </div>
      ) : (
        <Tablero filas={filas} />
      )}
    </div>
  );
}

function TablaLeads({ filas }: { filas: Fila[] }) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            <th>Negocio</th><th>Nicho · Zona</th><th>Teléfono</th><th>Web</th><th>Oport.</th><th>Estado</th><th>Próxima acción</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ n, lead, a }) => (
            <tr key={n.id}>
              <td style={{ minWidth: 170 }}>
                <Link to={`/negocio/${n.id}`} className="nombre">{n.nombre}</Link>
                <div className="tenue" style={{ fontSize: 12 }}>{n.dedicacion}</div>
              </td>
              <td className="tenue">{n.nicho}<br />{n.zona}</td>
              <td>{telefonoEnlace(n) ? <a href={telefonoEnlace(n)!} style={{ whiteSpace: 'nowrap' }}>{n.telNacional ?? n.telInternacional}</a> : '—'}</td>
              <td><EtiquetaWeb n={n} /></td>
              <td><Oportunidad p={puntuar(n, a)} /></td>
              <td><SelectorEstado valor={lead.estado} alCambiar={(estado) => actualizarLead(n.id, { estado })} /></td>
              <td>
                <input type="date" value={lead.proximaAccion ?? ''} onChange={(e) => actualizarLead(n.id, { proximaAccion: e.target.value || null })} aria-label="Próxima acción" />
              </td>
              <td><span className="recortar tenue" title={lead.notas} style={{ maxWidth: 200 }}>{lead.notas || '—'}</span></td>
              <td>
                <button
                  className="fantasma pequeno peligro"
                  title="Quitar de mis leads"
                  onClick={() => window.confirm(`¿Quitar «${n.nombre}» de tus leads? Se conservan el análisis y los borradores.`) && repo.eliminarLead(n.id)}
                >
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tablero({ filas }: { filas: Fila[] }) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));
  const alSoltar = (e: DragEndEvent) => {
    const destino = e.over?.id as EstadoLead | undefined;
    const id = String(e.active.id);
    const fila = filas.find((f) => f.n.id === id);
    if (destino && fila && fila.lead.estado !== destino) actualizarLead(id, { estado: destino });
  };
  return (
    <DndContext sensors={sensores} onDragEnd={alSoltar}>
      <div className="tablero">
        {ESTADOS.map((e) => (
          <Columna key={e.id} id={e.id} titulo={e.etiqueta} filas={filas.filter((f) => f.lead.estado === e.id)} />
        ))}
      </div>
    </DndContext>
  );
}

function Columna({ id, titulo, filas }: { id: EstadoLead; titulo: string; filas: Fila[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`columna ${isOver ? 'sobre' : ''}`}>
      <div className="cab"><span>{titulo}</span><span className="tenue">{filas.length}</span></div>
      <div className="lista">
        {filas.map((f) => <Tarjeta key={f.n.id} f={f} />)}
      </div>
    </div>
  );
}

function Tarjeta({ f }: { f: Fila }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: f.n.id });
  const p = puntuar(f.n, f.a);
  return (
    <div
      ref={setNodeRef}
      className={`ficha-mini ${isDragging ? 'arrastrando' : ''}`}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10, position: 'relative' } : undefined}
      {...listeners}
      {...attributes}
    >
      <div className="fila entre" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <Link to={`/negocio/${f.n.id}`} style={{ fontWeight: 600, color: 'var(--texto)' }} onPointerDown={(e) => e.stopPropagation()}>{f.n.nombre}</Link>
        <span onPointerDown={(e) => e.stopPropagation()}><Oportunidad p={p} /></span>
      </div>
      <div className="tenue">{f.n.dedicacion ?? f.n.nicho}</div>
      {f.lead.proximaAccion && <div style={{ marginTop: 4 }}>Próxima acción: <strong>{fechaCorta(f.lead.proximaAccion)}</strong></div>}
      <div className="solo-movil" style={{ marginTop: 6 }} onPointerDown={(e) => e.stopPropagation()}>
        <SelectorEstado valor={f.lead.estado} alCambiar={(estado) => actualizarLead(f.n.id, { estado })} />
      </div>
    </div>
  );
}
