import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { treg, mensajeError, type PersonaTreg } from '../api/cliente';
import { repo } from '../datos';
import { useDatos } from '../estado/useDatos';
import { actualizarLead } from '../logica/leads';
import { evaluarICP, indicadoresFunnel, PERFILES, type PerfilICP } from '../logica/icp';
import { EtiquetaWeb, SelectorEstado } from '../componentes/ui';
import type { Analisis, Lead, Negocio } from '../../shared/tipos';

type Fila = { n: Negocio; l: Lead; a?: Analisis };
const CARGOS = ['owner', 'founder', 'CEO', 'director', 'gerente general', 'administrador'];
const dinero = (n: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 6 }).format(n);
function dominioPropio(n?: Negocio) {
  if (!n || n.tipoWeb !== 'propia' || !n.web) return '';
  try { return new URL(n.web.startsWith('http') ? n.web : `https://${n.web}`).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}
export function Inteligencia() {
  const { datos, cargando } = useDatos(async () => {
    const leads = await repo.listarLeads();
    const [negocios, analisis] = await Promise.all([repo.listarNegocios(leads.map((l) => l.negocioId)), repo.listarAnalisis()]);
    const nm = new Map(negocios.map((n) => [n.id, n]));
    const am = new Map(analisis.map((a) => [a.negocioId, a]));
    return leads.flatMap((l): Fila[] => nm.has(l.negocioId) ? [{ l, n: nm.get(l.negocioId)!, a: am.get(l.negocioId) }] : []);
  }, []);
  const [perfil, setPerfil] = useState<PerfilICP>('web');
  const [sectorSolo, setSectorSolo] = useState(true);
  const [soloConWeb, setSoloConWeb] = useState(false);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [estadoTreg, setEstadoTreg] = useState<{ habilitado: boolean; topePorLlamadaUsd: number } | null>(null);
  const [clave, setClave] = useState(''); // deliberadamente solo memoria React
  const [domain, setDomain] = useState('');
  const [cargo, setCargo] = useState('owner');
  const [nombre, setNombre] = useState('');
  const [personas, setPersonas] = useState<PersonaTreg[]>([]);
  const [cargandoTreg, setCargandoTreg] = useState<'personas' | 'correo' | null>(null);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState('');
  const [verDetalle, setVerDetalle] = useState<string | null>(null);

  useEffect(() => { treg.estado().then(setEstadoTreg).catch(() => setEstadoTreg(null)); }, []);
  const todas = datos ?? [];
  const conWebPropia = (n: Negocio) => n.tipoWeb === 'propia' && Boolean(n.web);
  const { ordenadas, ocultosSector, ocultosWeb } = useMemo(() => {
    const evaluadas = todas.map((f) => ({ ...f, icp: evaluarICP(f.n, f.a, perfil) }));
    const delSector = evaluadas.filter((f) => !sectorSolo || f.icp.coincidencia);
    const visibles = delSector.filter((f) => !soloConWeb || conWebPropia(f.n));
    // A igual puntuación, primero las que tienen web propia (las únicas que Treg puede buscar).
    visibles.sort((a, b) => b.icp.puntuacion - a.icp.puntuacion || Number(conWebPropia(b.n)) - Number(conWebPropia(a.n)));
    return { ordenadas: visibles, ocultosSector: evaluadas.length - delSector.length, ocultosWeb: delSector.length - visibles.length };
  }, [todas, perfil, sectorSolo, soloConWeb]);
  const funnel = indicadoresFunnel(todas.map((f) => f.l));
  const seleccion = todas.find((f) => f.n.id === seleccionId);
  const tope = estadoTreg?.topePorLlamadaUsd ?? 0.15;

  const elegir = (f: Fila) => {
    setSeleccionId(f.n.id);
    setDomain(dominioPropio(f.n));
    setNombre(f.l.contacto?.nombre ?? '');
    setCargo(CARGOS.includes(f.l.contacto?.cargo ?? '') ? f.l.contacto!.cargo : 'owner');
    setPersonas([]);
    setResultado('');
    setError('');
  };

  const buscarPersonas = async () => {
    setCargandoTreg('personas'); setError(''); setResultado(''); setPersonas([]);
    try {
      const r = await treg.personas(clave, domain, cargo);
      setPersonas(r.personas);
      setResultado(`Consulta de perfiles: ${r.personas.length} resultados · ${dinero(r.costoUsd)} · proveedor: ${r.proveedor} · id: ${r.callId ?? 'no informado'}.`);
    } catch (e) { setError(mensajeError(e)); }
    finally { setCargandoTreg(null); }
  };

  const obtenerCorreo = async () => {
    if (!seleccion) return;
    setCargandoTreg('correo'); setError(''); setResultado('');
    try {
      const r = await treg.correo(clave, domain, nombre, cargo);
      await actualizarLead(seleccion.n.id, { contacto: r.contacto });
      setResultado(`Correo ${r.contacto.email ? 'encontrado' : 'no encontrado'} · verificación: ${r.contacto.verificacion} · costo: ${dinero(r.costoUsd)} · proveedor: ${r.proveedor}. ${r.contacto.verificacion !== 'valid' ? 'No enviar hasta confirmar la validez.' : ''}`);
    } catch (e) { setError(mensajeError(e)); }
    finally { setCargandoTreg(null); }
  };

  return <div className="pila">
    <div className="cabecera">
      <div>
        <h1>Inteligencia comercial B2B</h1>
        <p>Priorice leads guardados por producto. El puntaje indica coincidencia heurística, no probabilidad de compra.</p>
      </div>
      <Link to="/buscar" className="boton">Encontrar más negocios</Link>
    </div>

    <section className="panel panel-cuerpo pila">
      <div className="rejilla-2">
        <label className="campo">
          Producto o servicio objetivo
          <select value={perfil} onChange={(e) => { setPerfil(e.target.value as PerfilICP); setVerDetalle(null); }}>
            {Object.entries(PERFILES).map(([id, v]) => <option value={id} key={id}>{v.nombre}</option>)}
          </select>
        </label>
        <div className="campo">
          <span>Filtro de mercado objetivo</span>
          <label className="check"><input type="checkbox" checked={sectorSolo} onChange={(e) => setSectorSolo(e.target.checked)} /> Solo negocios del sector compatible</label>
          <label className="check"><input type="checkbox" checked={soloConWeb} onChange={(e) => setSoloConWeb(e.target.checked)} /> Solo con web propia (para buscar contactos)</label>
          <small>{PERFILES[perfil].descripcion}</small>
        </div>
      </div>
      <p className="tenue" style={{ margin: 0 }}>Los datos se calculan a partir de sus registros ya guardados. No se realizan búsquedas ni cargos al cambiar los filtros.</p>
    </section>

    <div className="rejilla-2">
      <section className="panel panel-cuerpo">
        <small>Leads guardados</small>
        <h1>{funnel.total}</h1>
        <small>Con correo verificado: {funnel.correosVerificados}</small>
      </section>
      <section className="panel panel-cuerpo">
        <small>Contactados / Reunión / Cliente</small>
        <h1>{funnel.contactados} / {funnel.reuniones} / {funnel.clientes}</h1>
        <small>Clientes sobre leads guardados: {funnel.conversionSobreLeads}%</small>
      </section>
    </div>

    <section className="panel">
      <div className="panel-cab"><h2>Prospectos priorizados ({ordenadas.length})</h2><small>Seleccione una empresa para descubrir decisores y verificar contactos</small></div>
      {todas.length > ordenadas.length && (
        <div className="panel-cuerpo fila entre" style={{ borderBottom: '1px solid var(--borde)' }}>
          <span className="tenue">
            {todas.length - ordenadas.length} de {todas.length} leads ocultos
            {ocultosSector > 0 ? ` · ${ocultosSector} no son del sector de «${PERFILES[perfil].nombre}»` : ''}
            {ocultosWeb > 0 ? ` · ${ocultosWeb} sin web propia` : ''}.
          </span>
          <button className="pequeno" onClick={() => { setSectorSolo(false); setSoloConWeb(false); }}>Ver todos</button>
        </div>
      )}
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead><tr><th>Empresa</th><th>Sector</th><th>Web</th><th>Puntaje ICP</th><th>Estado</th><th>Contacto</th><th>Acciones</th></tr></thead>
          <tbody>
            {ordenadas.map((f) => <tr key={f.n.id}>
              <td className="nombre"><Link to={`/negocio/${encodeURIComponent(f.n.id)}`}>{f.n.nombre}</Link><small style={{ display: 'block' }}>{f.n.zona}</small></td>
              <td>{f.n.dedicacion ?? f.n.nicho}</td>
              <td><EtiquetaWeb n={f.n} /></td>
              <td><strong>{f.icp.puntuacion}/100</strong><small style={{ display: 'block' }}>{f.icp.confianza === 'con-evidencia' ? 'Con análisis web' : 'Preliminar'}</small></td>
              <td><SelectorEstado valor={f.l.estado} alCambiar={(estado) => actualizarLead(f.n.id, { estado })} /></td>
              <td>{f.l.contacto?.email ? <><span>{f.l.contacto.email}</span><small style={{ display: 'block' }}>Verificación: {f.l.contacto.verificacion}</small></> : 'Pendiente'}</td>
              <td><div className="fila">
                {conWebPropia(f.n) ? (
                  <button className="pequeno" onClick={() => { elegir(f); setVerDetalle(null); }}>Prospectar</button>
                ) : (
                  <button className="pequeno" disabled title="Treg necesita la web propia de la empresa para buscar contactos">Sin dominio</button>
                )}
                <button className="pequeno fantasma" onClick={() => setVerDetalle(verDetalle === f.n.id ? null : f.n.id)}>Motivos</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {verDetalle ? (() => {
        const f = ordenadas.find((x) => x.n.id === verDetalle);
        return f ? <div className="panel-cuerpo" style={{ borderTop: '1px solid var(--borde)' }}>
          <h2>Por qué {f.n.nombre}: {f.icp.puntuacion}/100</h2>
          <ul>{f.icp.motivos.map((m) => <li key={m.texto}>{m.texto} (+{m.puntos})</li>)}</ul>
          <strong>Por comprobar antes de ofrecer el servicio</strong>
          <ul>{f.icp.porComprobar.map((m) => <li key={m}>{m}</li>)}</ul>
        </div> : null;
      })() : null}
      {!cargando && todas.length === 0 && <div className="panel-cuerpo">Todavía no hay leads guardados. <Link to="/buscar">Busque empresas</Link> y guárdelas primero.</div>}
      {cargando && <div className="panel-cuerpo">Cargando información comercial…</div>}
      {!cargando && todas.length > 0 && ordenadas.length === 0 && <div className="panel-cuerpo">No hay leads del sector elegido. Pulse «Ver todos» para revisar las demás empresas.</div>}
    </section>

    <section className="panel" style={{ scrollMarginTop: 80 }}>
      <div className="panel-cab"><h2>Enriquecimiento de contactos con Treg</h2><small>Consultas individuales, nunca campañas automáticas</small></div>
      <div className="panel-cuerpo pila">
        {!seleccion ? <p className="tenue">Pulse «Prospectar» en una empresa de la tabla para comenzar.</p> : <>
          <div><strong>{seleccion.n.nombre}</strong> · {seleccion.n.dedicacion ?? seleccion.n.nicho}</div>
          {!estadoTreg?.habilitado && <div className="aviso-caja">Treg está desactivado en el servidor. Configure los secretos necesarios y Cloudflare Access antes de usar consultas de pago.</div>}
          <div className="rejilla-2">
            <label className="campo">
              Dominio propio de la empresa
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="empresa.com.ec" />
              <small>Confirmar que pertenece a esta empresa; no utilizar facebook.com o directorios.</small>
            </label>
            <label className="campo">
              Clave administrativa temporal
              <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="off" placeholder="Acceso autorizado" />
              <small>No se guarda en el navegador. Requiere además Cloudflare Access.</small>
            </label>
          </div>
          <div className="rejilla-2">
            <label className="campo">Cargo del decisor
              <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
                {CARGOS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div className="campo"><span>1. Localizar decisores</span>
              <button type="button" disabled={!estadoTreg?.habilitado || !clave || !domain || !!cargandoTreg} onClick={buscarPersonas}>{cargandoTreg === 'personas' ? 'Buscando…' : 'Buscar perfiles (máximo 5)'}</button>
              <small>Tope de {dinero(tope)} por solicitud. Incluso sin resultados puede haber cargo.</small>
            </div>
          </div>
          {personas.length > 0 && <div className="panel panel-cuerpo pila">
            <strong>Personas encontradas (sin correo verificado)</strong>
            {personas.map((p, i) => <div className="fila entre" key={`${p.nombre}-${i}`}>
              <span>{p.nombre} · {p.cargo || 'Cargo no informado'} {p.linkedin ? <a href={p.linkedin} rel="noreferrer" target="_blank">Perfil público</a> : null}</span>
              <button className="pequeno" onClick={() => { setNombre(p.nombre); if (CARGOS.includes(p.cargo)) setCargo(p.cargo); }}>Seleccionar</button>
            </div>)}
          </div>}
          <div className="rejilla-2">
            <label className="campo">
              Nombre y apellido del responsable
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre Apellido" />
            </label>
            <div className="campo"><span>2. Encontrar y verificar correo empresarial</span>
              <button className="primario" type="button" disabled={!estadoTreg?.habilitado || !clave || !domain || nombre.trim().split(/\s+/).length < 2 || !!cargandoTreg}
                onClick={obtenerCorreo}>{cargandoTreg === 'correo' ? 'Verificando…' : 'Buscar correo y verificar'}</button>
              <small>Un correo encontrado no significa que esté verificado: observe el veredicto.</small>
            </div>
          </div>
          {seleccion.l.contacto && <div className="info-caja">
            Último contacto guardado: <strong>{seleccion.l.contacto.nombre}</strong> · {seleccion.l.contacto.email ?? 'No encontrado'} · estado: {seleccion.l.contacto.verificacion} · {seleccion.l.contacto.proveedor}
          </div>}
          {resultado && <div className="info-caja">{resultado}</div>}
          {error && <div className="aviso-caja">{error}</div>}
          <small>No se envían mensajes ni se hacen búsquedas en lote. El costo máximo aplica a cada llamada y no sustituye un presupuesto total. Los datos personales deben tratarse con base legal y según los términos del proveedor.</small>
        </>}
      </div>
    </section>
  </div>;
}
