import { useEffect, useState } from 'react';
import { TONOS } from '../../shared/tipos';
import { api, mensajeError } from '../api/cliente';
import { Cargando, ErrorCaja } from '../componentes/ui';
import { repo } from '../datos';
import { useAjustes, usoDelMes } from '../datos/ajustes';

const REGIONES = [
  ['ES', 'España'], ['EC', 'Ecuador'], ['MX', 'México'], ['CO', 'Colombia'], ['PE', 'Perú'], ['CL', 'Chile'],
  ['AR', 'Argentina'], ['US', 'Estados Unidos'], ['VE', 'Venezuela'], ['BO', 'Bolivia'], ['GT', 'Guatemala'],
  ['CR', 'Costa Rica'], ['PA', 'Panamá'], ['DO', 'República Dominicana'], ['UY', 'Uruguay'], ['PY', 'Paraguay'],
];

export function Ajustes() {
  const a = useAjustes();
  const [estado, setEstado] = useState<{ gemini: boolean; google: boolean; modeloGemini: string | null } | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [verClave, setVerClave] = useState(false);
  const uso = usoDelMes(a);

  useEffect(() => {
    api.estado().then(setEstado).catch((e) => setErrorEstado(mensajeError(e)));
  }, [a.modeloGemini]);

  return (
    <div className="pila" style={{ maxWidth: 860 }}>
      <div className="cabecera">
        <div>
          <h1>Ajustes</h1>
          <p>Se guardan solo en este navegador.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-cab"><h2>Claves y servicios</h2></div>
        <div className="panel-cuerpo pila">
          {errorEstado && <ErrorCaja titulo="No se pudo consultar el servidor" mensaje={errorEstado} />}
          {!estado && !errorEstado && <Cargando texto="Comprobando secretos del entorno…" />}
          {estado && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                Gemini: {estado.gemini ? <span className="etiqueta verde">Configurado en el entorno</span> : <span className="etiqueta rojo">Falta GEMINI_API_KEY</span>}
                {estado.modeloGemini && <span className="tenue"> · modelo: <code>{estado.modeloGemini}</code></span>}
              </li>
              <li>
                Places y PageSpeed (Google Cloud):{' '}
                {estado.google ? <span className="etiqueta verde">Configurado como secreto del entorno</span> : a.claveGoogle ? <span className="etiqueta ambar">Usando la clave de este navegador</span> : <span className="etiqueta rojo">Falta la clave</span>}
              </li>
            </ul>
          )}
          {estado && !estado.google && (
            <label className="campo">
              Clave de Google Cloud (Places API New + PageSpeed Insights)
              <span className="fila">
                <input
                  type={verClave ? 'text' : 'password'}
                  value={a.claveGoogle}
                  onChange={(e) => a.cambiar({ claveGoogle: e.target.value.trim() })}
                  placeholder="AIza…"
                  autoComplete="off"
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={() => setVerClave(!verClave)}>{verClave ? 'Ocultar' : 'Mostrar'}</button>
              </span>
              <small style={{ fontWeight: 400 }}>
                Lo ideal es guardarla como secreto: <code>npx wrangler secret put GOOGLE_CLOUD_API_KEY</code>. Mientras tanto se guarda solo
                en este navegador y se envía a tu propio Worker en cada llamada.
              </small>
            </label>
          )}
          <label className="campo">
            Modelo de Gemini
            <input value={a.modeloGemini} onChange={(e) => a.cambiar({ modeloGemini: e.target.value.trim() })} placeholder="Automático (el Flash más reciente)" />
            <small style={{ fontWeight: 400 }}>Déjalo vacío para usar automáticamente el Flash más reciente disponible.</small>
          </label>
          <label className="campo" style={{ maxWidth: 320 }}>
            Región de búsqueda (regionCode de Places)
            <select value={a.regionCode} onChange={(e) => a.cambiar({ regionCode: e.target.value })}>
              {REGIONES.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
            </select>
            <small style={{ fontWeight: 400 }}>Sesga los resultados y el formato de los teléfonos. Para Cuenca (Ecuador) conviene EC.</small>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-cab"><h2>Mi perfil de vendedor</h2><small>Se usa para redactar los borradores</small></div>
        <div className="panel-cuerpo pila">
          <div className="rejilla-2">
            <label className="campo">
              Nombre
              <input value={a.perfil.nombre} onChange={(e) => a.cambiarPerfil({ nombre: e.target.value })} placeholder="Tu nombre (y empresa, si tienes)" />
            </label>
            <label className="campo">
              Tono de los mensajes
              <select value={a.perfil.tono} onChange={(e) => a.cambiarPerfil({ tono: e.target.value })}>
                {TONOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label className="campo">
            Qué vendo
            <textarea rows={2} value={a.perfil.queVendo} onChange={(e) => a.cambiarPerfil({ queVendo: e.target.value })} placeholder="Páginas web, agentes de IA por WhatsApp, sistemas de citas, apps web a medida (como NidoCerca para guarderías)…" />
          </label>
          <label className="campo">
            Mi propuesta
            <textarea rows={3} value={a.perfil.propuesta} onChange={(e) => a.cambiarPerfil({ propuesta: e.target.value })} placeholder="Qué te diferencia: precio cerrado, entrega en 7 días, soporte local, primera revisión gratis…" />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-cab"><h2>Uso de Places este mes</h2></div>
        <div className="panel-cuerpo pila">
          <div className="fila entre">
            <strong style={{ fontSize: 22 }}>{uso} <span className="tenue" style={{ fontSize: 14, fontWeight: 400 }}>de {a.limiteMensual} llamadas gratuitas</span></strong>
            {uso >= a.umbralAviso && <span className="etiqueta ambar">Aviso: has llegado a {a.umbralAviso}</span>}
          </div>
          <div className={`barra ${uso >= a.limiteMensual ? 'rojo' : uso >= a.umbralAviso ? 'ambar' : ''}`} style={{ height: 10 }}>
            <span style={{ width: `${Math.min(100, (uso / a.limiteMensual) * 100)}%` }} />
          </div>
          <div className="fila" style={{ gap: 16 }}>
            <label className="campo">
              Límite mensual
              <input type="number" min={1} value={a.limiteMensual} onChange={(e) => a.cambiar({ limiteMensual: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 120 }} />
            </label>
            <label className="campo">
              Avisar a partir de
              <input type="number" min={1} value={a.umbralAviso} onChange={(e) => a.cambiar({ umbralAviso: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 120 }} />
            </label>
          </div>
          <small>
            Cuenta las llamadas hechas desde este navegador (cada página de 20 resultados = 1 llamada). Las búsquedas en caché no cuentan.
            Revisa el consumo real en la consola de Google Cloud.
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-cab"><h2>Datos locales</h2></div>
        <div className="panel-cuerpo fila entre">
          <small>Leads, análisis, borradores, caché de búsquedas y radares se guardan en IndexedDB en este navegador.</small>
          <button
            className="peligro"
            onClick={async () => {
              if (window.confirm('¿Borrar todos los leads, análisis, borradores y la caché? Los ajustes se conservan. No se puede deshacer.')) {
                await repo.borrarTodo();
              }
            }}
          >
            Borrar datos locales
          </button>
        </div>
      </section>
    </div>
  );
}
