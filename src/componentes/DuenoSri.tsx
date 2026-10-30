import { useState } from 'react';
import type { Negocio } from '../../shared/tipos';
import { URL_SRI_RUC, URL_SUPERCIAS, cantonDeDireccion, nombrePropio, type CandidatoSri } from '../../shared/sri';
import { api, mensajeError } from '../api/cliente';
import { BotonCopiar, Cargando, ErrorCaja } from './ui';

/**
 * Busca el dueño o responsable en el catastro RUC del SRI (datos abiertos, gratis).
 * Nunca asigna solo: el usuario confirma con «Usar este nombre».
 */
export function DuenoSri({ n, alUsar, textoUsar = 'Usar este nombre' }: { n: Negocio; alUsar: (nombre: string, c: CandidatoSri) => void; textoUsar?: string }) {
  const [estado, setEstado] = useState<'inicio' | 'cargando' | 'listo'>('inicio');
  const [candidatos, setCandidatos] = useState<CandidatoSri[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usado, setUsado] = useState<string | null>(null);

  const buscar = async () => {
    setEstado('cargando');
    setError(null);
    try {
      const r = await api.sri(n.nombre, cantonDeDireccion(n.direccion));
      setCandidatos(r.candidatos);
      setEstado('listo');
    } catch (e) {
      setError(mensajeError(e));
      setEstado('inicio');
    }
  };

  return (
    <div className="pila" style={{ gap: 8 }}>
      <div className="fila entre">
        <strong style={{ fontSize: 13 }}>Dueño o responsable (SRI)</strong>
        <button type="button" className="pequeno" onClick={buscar} disabled={estado === 'cargando'}>
          {estado === 'cargando' ? <span className="girando" /> : null} {estado === 'listo' ? 'Buscar de nuevo' : 'Buscar dueño en el SRI'}
        </button>
      </div>
      {estado === 'cargando' && <Cargando texto="Buscando en el catastro RUC…" />}
      {error && <ErrorCaja titulo="No se pudo consultar el SRI" mensaje={error} />}
      {estado === 'listo' && candidatos.length === 0 && (
        <div className="info-caja">
          No aparece en el SRI con ese nombre (puede estar registrado con otro nombre comercial). Prueba la{' '}
          <a href={URL_SRI_RUC} target="_blank" rel="noopener noreferrer">consulta de RUC del SRI</a> o la{' '}
          <a href={URL_SUPERCIAS} target="_blank" rel="noopener noreferrer">consulta de compañías</a>.
        </div>
      )}
      {candidatos.map((c) => (
        <div key={`${c.ruc}-${c.nombreComercial}`} className="borrador" style={{ padding: '8px 10px', fontSize: 12.5 }}>
          <div className="fila entre" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <strong>{c.nombreComercial || '(sin nombre comercial)'}</strong>
              <div>
                {c.tipo === 'PERSONA NATURAL' ? 'Dueño: ' : 'Razón social: '}
                <strong>{c.razonSocial}</strong>
              </div>
              <div className="sub">
                RUC {c.ruc} · {c.tipo === 'PERSONA NATURAL' ? 'Persona natural' : 'Sociedad'} · {c.canton}
                {c.parroquia ? ` (${c.parroquia})` : ''}
              </div>
              <div className="sub">{c.actividad}</div>
            </div>
            <span className="fila" style={{ gap: 4, flex: 'none' }}>
              <BotonCopiar texto={c.ruc} etiqueta="RUC" />
              {c.duenoProbable && (
                <button
                  type="button"
                  className="pequeno primario"
                  onClick={() => {
                    alUsar(nombrePropio(c.duenoProbable!), c);
                    setUsado(c.ruc);
                  }}
                >
                  {usado === c.ruc ? '✓ Usado' : textoUsar}
                </button>
              )}
            </span>
          </div>
          {!c.duenoProbable && (
            <div className="sub" style={{ marginTop: 4 }}>
              Es una compañía: el representante legal está en la{' '}
              <a href={URL_SUPERCIAS} target="_blank" rel="noopener noreferrer">Superintendencia de Compañías</a> (busca por RUC o nombre).
            </div>
          )}
        </div>
      ))}
      {estado === 'listo' && candidatos.length > 0 && (
        <small className="muy-tenue">
          Confirma que el negocio coincide antes de usarlo. Datos abiertos del SRI (Azuay, actualizados ene-2025). Úsalos solo para contacto personal uno a uno.
        </small>
      )}
    </div>
  );
}
