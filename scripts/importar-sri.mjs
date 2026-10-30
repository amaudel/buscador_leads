// Prepara el catastro RUC del SRI (datos abiertos) para Cloudflare D1.
//
// Uso:
//   curl -o SRI_RUC_Azuay.csv https://descargas.sri.gob.ec/download/datosAbiertos/SRI_RUC_Azuay.csv
//   node scripts/importar-sri.mjs SRI_RUC_Azuay.csv
//   for f in .wrangler/sri/*.sql; do npx wrangler d1 execute radar-sri --remote --yes --file "$f"; done
//
// Solo se cargan contribuyentes ACTIVOS con establecimiento abierto (ABI).
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node scripts/importar-sri.mjs <SRI_RUC_Provincia.csv>');
  process.exit(1);
}
const SALIDA = '.wrangler/sri';
const POR_ARCHIVO = 20000; // filas por archivo SQL
const POR_INSERT = 200; // filas por sentencia INSERT

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

const esc = (s) => `'${String(s ?? '').replace(/'/g, "''").trim()}'`;
// Quita comillas de CSV mal escapadas: "GUARDERÍA ""EL RINCÓN""" → GUARDERÍA "EL RINCÓN"
const limpiar = (s) => s.replace(/^"+|"+$/g, '').replace(/""/g, '"').trim();
const recortar = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

writeFileSync(
  `${SALIDA}/000-esquema.sql`,
  `DROP TABLE IF EXISTS sri;
CREATE VIRTUAL TABLE sri USING fts5(
  nombre_comercial, razon_social,
  ruc UNINDEXED, tipo UNINDEXED, canton UNINDEXED, parroquia UNINDEXED, actividad UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
`,
);

let cab = null;
let filas = [];
let lote = [];
let nArchivo = 1;
let total = 0;
const vistos = new Set();

const volcarLote = () => {
  if (!lote.length) return;
  filas.push(`INSERT INTO sri (nombre_comercial, razon_social, ruc, tipo, canton, parroquia, actividad) VALUES\n${lote.join(',\n')};`);
  lote = [];
};
const volcarArchivo = () => {
  volcarLote();
  if (!filas.length) return;
  writeFileSync(`${SALIDA}/${String(nArchivo++).padStart(3, '0')}-datos.sql`, filas.join('\n') + '\n');
  filas = [];
};

const rl = createInterface({ input: createReadStream(archivo, 'utf8'), crlfDelay: Infinity });
for await (const linea of rl) {
  const c = linea.split('|');
  if (!cab) {
    cab = Object.fromEntries(c.map((n, i) => [n.trim(), i]));
    continue;
  }
  const v = (n) => (c[cab[n]] ?? '').trim();
  if (v('ESTADO_CONTRIBUYENTE') !== 'ACTIVO' || v('ESTADO_ESTABLECIMIENTO') !== 'ABI') continue;
  const ruc = v('NUMERO_RUC');
  if (!/^\d{13}$/.test(ruc)) continue; // línea mal formada
  const clave = `${ruc}-${v('NUMERO_ESTABLECIMIENTO')}`;
  if (vistos.has(clave)) continue;
  vistos.add(clave);
  lote.push(
    `(${[
      esc(limpiar(v('NOMBRE_FANTASIA_COMERCIAL'))),
      esc(limpiar(v('RAZON_SOCIAL'))),
      esc(ruc),
      esc(v('TIPO_CONTRIBUYENTE')),
      esc(v('DESCRIPCION_CANTON_EST')),
      esc(v('DESCRIPCION_PARROQUIA_EST')),
      esc(recortar(v('ACTIVIDAD_ECONOMICA'), 140)),
    ].join(', ')})`,
  );
  total++;
  if (lote.length >= POR_INSERT) volcarLote();
  if (total % POR_ARCHIVO === 0) volcarArchivo();
}
volcarArchivo();
console.log(`Listo: ${total} establecimientos activos en ${nArchivo - 1} archivos + esquema, en ${SALIDA}/`);
