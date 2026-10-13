import { useEffect, useState } from 'react';
import { TONOS } from '../../shared/tipos';
import { api, mensajeError } from '../api/cliente';
import { ErrorCaja } from '../componentes/ui';
import { repo } from '../datos';
import { useAjustes, usoDelMes } from '../datos/ajustes';

const REGIONES = [
  ['ES', 'España'], ['EC', 'Ecuador'], ['MX', 'México'], ['CO', 'Colombia'], ['PE', 'Perú'], ['CL', 'Chile'],
  ['AR', 'Argentina'], ['US', 'Estados Unidos'], ['VE', 'Venezuela'], ['BO', 'Bolivia'], ['GT', 'Guatemala'],
  ['CR', 'Costa Rica'], ['PA', 'Panamá'], ['DO', 'República Dominicana'], ['UY', 'Uruguay'], ['PY', 'Paraguay'],
];

export function Ajustes() {
  const a = useAjustes();
  const [estado, setEstado] = useState<Awaited<ReturnType<typeof api.estado>> | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const uso = usoDelMes(a);

  useEffect(() => {
    api.estado().then(setEstado).catch((e) => setErrorEstado(mensajeError(e)));
  }, [a.modeloGemini, a.claveGemini, a.claveGoogle]);

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
          <CampoClave
            titulo="Clave de Gemini"
            ayuda="Sácala gratis en aistudio.google.com → «Get API key»."
            valor={a.claveGemini}
            alCambiar={(v) => a.cambiar({ claveGemini: v })}
            servicio="gemini"
            hayRespaldo={estado?.secretos.gemini ?? false}
          />
          <CampoClave
            titulo="Clave de Google Cloud (Places API New y PageSpeed Insights)"
            ayuda="En console.cloud.google.com activa «Places API (New)» y «PageSpeed Insights API», crea una clave y restríngela a esas dos APIs. Probarla no gasta del cupo."
            valor={a.claveGoogle}
            alCambiar={(v) => a.cambiar({ claveGoogle: v })}
            servicio="google"
            hayRespaldo={estado?.secretos.google ?? false}
          />
          <small>
            Las claves se guardan solo en este navegador. Si usas la app en otro dispositivo, tendrás que pegarlas allí también.
          </small>
          {estado?.modeloGemini && (
            <small>Modelo de Gemini en uso: <code>{estado.modeloGemini}</code></small>
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
        <div className="panel-cab">
          <h2>Apariencia</h2>
          <div className="segmentado" role="group" aria-label="Tema">
            {(['oscuro', 'claro', 'sistema'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={a.tema === t} onClick={() => a.cambiar({ tema: t })}>
                {t === 'oscuro' ? 'Oscuro' : t === 'claro' ? 'Claro' : 'Según el sistema'}
              </button>
            ))}
          </div>
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

function CampoClave(p: {
  titulo: string;
  ayuda: string;
  valor: string;
  alCambiar: (v: string) => void;
  servicio: 'gemini' | 'google';
  hayRespaldo: boolean;
}) {
  const [ver, setVer] = useState(false);
  const [prueba, setPrueba] = useState<{ estado: 'probando' | 'ok' | 'error'; texto: string } | null>(null);
  const usable = Boolean(p.valor) || p.hayRespaldo;

  const probar = async () => {
    setPrueba({ estado: 'probando', texto: 'Probando…' });
    try {
      const r = await api.probar(p.servicio);
      setPrueba({ estado: 'ok', texto: r.detalle });
    } catch (e) {
      setPrueba({ estado: 'error', texto: mensajeError(e) });
    }
  };

  return (
    <div className="campo" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--texto-2)' }}>
      <span className="fila entre">
        {p.titulo}
        {p.valor ? (
          <span className="etiqueta verde">Pegada en este navegador</span>
        ) : p.hayRespaldo ? (
          <span className="etiqueta acento">Usando la del servidor</span>
        ) : (
          <span className="etiqueta rojo">Falta la clave</span>
        )}
      </span>
      <span className="fila">
        <input
          type={ver ? 'text' : 'password'}
          value={p.valor}
          onChange={(e) => {
            p.alCambiar(e.target.value.trim());
            setPrueba(null);
          }}
          placeholder="Pega aquí tu clave (AIza…)"
          autoComplete="off"
          spellCheck={false}
          aria-label={p.titulo}
          style={{ flex: '1 1 260px' }}
        />
        <button type="button" onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Mostrar'}</button>
        <button type="button" onClick={probar} disabled={!usable || prueba?.estado === 'probando'}>
          {prueba?.estado === 'probando' ? <span className="girando" /> : null} Probar
        </button>
        {p.valor && <button type="button" className="fantasma peligro" onClick={() => p.alCambiar('')}>Borrar</button>}
      </span>
      {prueba?.estado === 'ok' && <span className="c-verde">✓ {prueba.texto}</span>}
      {prueba?.estado === 'error' && <span className="c-rojo" style={{ overflowWrap: 'anywhere' }}>✕ {prueba.texto}</span>}
      <small style={{ fontWeight: 400 }}>{p.ayuda}</small>
    </div>
  );
}
