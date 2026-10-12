export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const claveBusqueda = (nicho: string, zona: string, region: string) =>
  `${normalizar(nicho)}|${normalizar(zona)}|${region.toUpperCase()}`;

export const NICHOS_SUGERIDOS = [
  'talleres mecánicos', 'clínicas dentales', 'fisioterapeutas', 'peluquerías', 'centros de estética',
  'restaurantes', 'gimnasios', 'academias', 'inmobiliarias', 'reformas', 'veterinarios', 'autoescuelas',
  'ópticas', 'gestorías',
];

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('es-419', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function telefonoEnlace(n: { telInternacional: string | null; telNacional: string | null }): string | null {
  const t = n.telInternacional ?? n.telNacional;
  return t ? `tel:${t.replace(/[^\d+]/g, '')}` : null;
}

export function whatsappEnlace(n: { telInternacional: string | null }): string | null {
  const t = n.telInternacional?.replace(/\D/g, '');
  return t ? `https://wa.me/${t}` : null;
}
