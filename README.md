# Radar de Clientes

Herramienta de prospección para vender servicios digitales (webs, agentes de IA por WhatsApp, sistemas de citas, apps web) a negocios locales. Te permite:

- buscar negocios en Google Maps;
- ver si tienen web propia;
- analizar su web con PageSpeed y Gemini;
- redactar el primer contacto;
- descubrir qué nichos tienen más oportunidad;
- llevar el seguimiento de tus leads.

**Stack:** Vite + React + TypeScript en un Cloudflare Worker con *static assets*. El Worker sirve la SPA y hace de proxy en `/api/*`.

**Claves:** se pegan en **Ajustes** (Gemini y Google Cloud), cada una con un botón «Probar». Se guardan solo en ese navegador y se envían a tu propio Worker en cada llamada. Si además hay secretos en Cloudflare, se usan como respaldo; la clave pegada tiene prioridad.

## Pantallas

| Pantalla | Qué hace |
| --- | --- |
| **Buscar** | Zona + nicho → Places Text Search (20 por página; «Cargar más» hasta 60). Incluye filtros, tabla o tarjetas, puntuación de oportunidad con desglose, «Guardar en mis leads» y «Analizar seleccionados». |
| **Ficha** (`/negocio/:id`) | Contacto y análisis: 4 notas de PageSpeed en móvil, captura, resumen, lista de comprobación, correos, redes, problemas y servicio recomendado. También genera los borradores (llamada, WhatsApp y correo) y guarda notas, estado y próxima acción. «Exportar ficha» abre la versión imprimible / PDF. |
| **Radar de nichos** | Mide una zona por categorías (editables). Avisa de las llamadas a Places que va a gastar y pide confirmación. Gemini ordena las categorías y recomienda el top 3. |
| **Mis leads** | Tabla y tablero por estados (arrastrar y soltar), filtros, búsqueda y exportación a CSV (compatible con Excel). |
| **Ajustes** | Claves de Gemini y Google Cloud (pegar y probar), región, perfil de vendedor, contador mensual de Places con aviso, modelo de Gemini. |

## APIs

- **Places API (New)**, `places:searchText`:
  - `languageCode: es`, `regionCode` configurable (por defecto `ES`) y `pageSize: 20`, con `pageToken` para las páginas siguientes.
  - FieldMask con solo los campos necesarios (ver `shared/places.ts`).
  - Cada página cuenta 1 en el contador mensual. Las búsquedas se guardan en caché 7 días.
- **PageSpeed Insights v5**: `strategy=mobile` con las 4 categorías. Se guardan las notas, varias métricas y la captura `final-screenshot`. No se llama si el negocio no tiene web propia.
- **Gemini**:
  - Usa automáticamente el *Flash* más reciente (`models.list`), o el modelo que indiques en Ajustes.
  - Para analizar la web intenta primero **URL context + salida JSON con esquema** en una sola llamada. Si la API no admite esa combinación, hace **dos llamadas**: leer la web y luego estructurar el resultado.
  - Todas las respuestas se validan con zod (`shared/esquemas.ts`).

Si una API falla, la interfaz muestra su mensaje de error real.

## Datos

Todo se guarda en el navegador:

- IndexedDB guarda leads, negocios, análisis, borradores, la caché de búsquedas y los radares.
- localStorage guarda los ajustes y el contador de uso.

La app accede a los datos solo a través de la interfaz `Repositorio` (`src/datos/repositorio.ts`). Para pasar a Firebase o D1 basta con escribir otra implementación.

## Desarrollo

```bash
npm install
npm run dev                      # http://localhost:5173 (Worker incluido); pega las claves en Ajustes
npm test                         # pruebas unitarias (lógica + Worker con fetch simulado)
npx playwright test              # recorrido completo con APIs simuladas
```

## Despliegue en Cloudflare

```bash
npx wrangler login
npm run deploy
```

Después abre la app, ve a **Ajustes**, pega tus claves y pulsa «Probar». En Google Cloud tienen que estar habilitadas **Places API (New)** y **PageSpeed Insights API** para esa clave (mejor restringida a esas dos APIs). Probar la clave de Google no gasta del cupo: usa Text Search pidiendo solo `places.id`.

Opcional: `npx wrangler secret put GEMINI_API_KEY` / `GOOGLE_CLOUD_API_KEY` como respaldo para cuando no haya clave pegada. Si los usas, protege la app con Cloudflare Access para que nadie más gaste esas claves.

## Puntuación de oportunidad (0–100)

Se parte de una base de 30 puntos y se suman o restan según estos criterios:

| Criterio | Puntos |
| --- | --- |
| No tiene web | +35 |
| Solo redes sociales o directorio | +30 |
| Reseñas: 50 o más | +15 |
| Reseñas: 15 o más | +8 |
| Reseñas: menos de 5 | −15 |
| Valoración de 4,3 o más | +10 |
| Valoración por debajo de 3,5 | −5 |
| Con teléfono / sin teléfono | +5 / −5 |
| Rendimiento móvil por debajo de 50 | +15 |
| Rendimiento móvil por debajo de 90 | +5 |
| Rendimiento móvil de 90 o más | −15 |
| SEO y accesibilidad de 90 o más | −10 |
| Sin botón de WhatsApp | +8 |
| Sin cita online | +8 |
| Sin HTTPS | +7 |
| No adaptada a móvil | +7 |
| Web desactualizada | +5 |
| Sin formulario de contacto | +3 |

Un negocio cerrado vale 0. Antes de analizar la web la nota es **provisional**: solo usa los datos de Maps. El desglose se muestra siempre.

> La app nunca envía mensajes. Los borradores son para un contacto personal; no envíes mensajes comerciales masivos sin consentimiento.
