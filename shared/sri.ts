// Búsqueda del dueño/responsable en el catastro RUC del SRI (datos abiertos).

export interface CandidatoSri {
  ruc: string;
  nombreComercial: string;
  razonSocial: string;
  tipo: 'PERSONA NATURAL' | 'SOCIEDAD' | string;
  canton: string;
  parroquia: string;
  actividad: string;
  /** Si es persona natural, la razón social es el nombre del dueño. */
  duenoProbable: string | null;
}

// Palabras que no ayudan a identificar el negocio.
const VACIAS = new Set([
  'centro', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'al', 'por', 'para', 'con',
  'cia', 'ltda', 'sa', 's', 'c', 'sas', 'cia.', 'compania', 'compañia', 'empresa', 'grupo',
  'the', 'and', 'of', 'ecuador', 'cuenca', 'azuay', 'local', 'matriz', 'sucursal',
]);

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Términos significativos del nombre de Google Maps (máximo 6). */
export function terminos(nombre: string): string[] {
  const vistos = new Set<string>();
  return normalizar(nombre)
    .split(' ')
    .filter((t) => t.length >= 2 && !VACIAS.has(t))
    .filter((t) => (vistos.has(t) ? false : (vistos.add(t), true)))
    .slice(0, 6);
}

/**
 * Consulta FTS5: todos los términos en nombre comercial o razón social.
 * Si hay muchos, basta con que coincidan los primeros (se usa OR como respaldo).
 */
export function consultaFts(ts: string[], modo: 'todos' | 'alguno' = 'todos'): string | null {
  if (!ts.length) return null;
  const partes = ts.map((t) => `"${t.replace(/"/g, '')}"*`);
  return partes.join(modo === 'todos' ? ' AND ' : ' OR ');
}

/** «LOPEZ SALAMEA JENNIFER ALEXIS» → «Jennifer Alexis Lopez Salamea». */
export function nombrePropio(razonSocial: string): string {
  const capital = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  const partes = razonSocial.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 3) {
    const apellidos = partes.slice(0, 2);
    const nombres = partes.slice(2);
    return [...nombres, ...apellidos].map(capital).join(' ');
  }
  return partes.map(capital).join(' ');
}

/** Cantón probable a partir de la dirección de Google Maps («…, Cuenca 010150, Ecuador»). */
export function cantonDeDireccion(direccion: string | null | undefined): string | null {
  if (!direccion) return null;
  const partes = direccion.split(',').map((p) => p.replace(/\d+/g, '').trim()).filter(Boolean);
  if (partes.length < 2) return null;
  const candidato = partes[partes.length - 2];
  return candidato && !/ecuador/i.test(candidato) ? normalizar(candidato).toUpperCase() : null;
}

export const URL_SUPERCIAS = 'https://appscvsgen.supercias.gob.ec/consultaCompanias/societario/busquedaCompanias.jsf';
export const URL_SRI_RUC = 'https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc';
