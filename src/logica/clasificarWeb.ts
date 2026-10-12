import type { TipoWeb } from '../../shared/tipos';

const REDES = [
  'facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'instagr.am', 'tiktok.com', 'twitter.com', 'x.com',
  'youtube.com', 'youtu.be', 'linkedin.com', 'pinterest.com', 'wa.me', 'whatsapp.com', 'api.whatsapp.com',
  'linktr.ee', 'linktree.com', 'beacons.ai', 'bio.link', 'taplink.cc', 'lnk.bio', 'campsite.bio', 'msha.ke',
  't.me', 'telegram.me', 'threads.net',
];

const DIRECTORIOS = [
  'business.site', 'g.page', 'goo.gl', 'maps.app.goo.gl', 'sites.google.com', 'google.com',
  'paginasamarillas', 'yelp.', 'tripadvisor.', 'doctoralia.', 'topdoctors.', 'booking.com', 'airbnb.',
  'glovoapp.com', 'ubereats.com', 'rappi.', 'pedidosya.', 'justeat.', 'just-eat.', 'deliveroo.',
  'thefork.', 'eltenedor.', 'treatwell.', 'fresha.com', 'booksy.com', 'cylex', 'infoisinfo', 'guiaempresas',
  'habitissimo.', 'cronoshare.', 'starofservice.', 'zaask.', 'milanuncios.', 'olx.', 'mercadolibre.',
  'idealista.', 'fotocasa.', 'plusvalia.',
  'empresite.', 'axesor.', 'hotfrog.', 'tuugo.', 'opendi.',
];

function host(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

const coincide = (h: string, dominio: string) =>
  dominio.endsWith('.') || !dominio.includes('.')
    ? h.includes(dominio)
    : h === dominio || h.endsWith(`.${dominio}`);

/** Clasifica la web que figura en Google Maps. Redes y directorios = «Sin web propia». */
export function clasificarWeb(url: string | null | undefined): TipoWeb {
  if (!url || !url.trim()) return 'ninguna';
  const h = host(url.trim());
  if (!h) return 'ninguna';
  if (REDES.some((d) => coincide(h, d))) return 'red_social';
  const completo = `${h}${(() => {
    try {
      return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).pathname;
    } catch {
      return '';
    }
  })()}`;
  if (DIRECTORIOS.some((d) => (d.includes('/') ? completo.startsWith(d) : coincide(h, d)))) return 'directorio';
  return 'propia';
}

export const tieneWebPropia = (t: TipoWeb) => t === 'propia';

export function etiquetaWeb(t: TipoWeb): string {
  return t === 'propia' ? 'Web propia' : t === 'ninguna' ? 'Sin web' : 'Sin web propia';
}
