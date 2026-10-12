import type { NegocioPlaces } from './tipos';

export const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.googleMapsUri',
  'places.businessStatus',
  'nextPageToken',
].join(',');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapearPlace(p: any): NegocioPlaces {
  return {
    id: String(p.id),
    nombre: p.displayName?.text ?? 'Sin nombre',
    dedicacion: p.primaryTypeDisplayName?.text ?? null,
    tipos: Array.isArray(p.types) ? p.types : [],
    direccion: p.formattedAddress ?? null,
    ubicacion: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    telNacional: p.nationalPhoneNumber ?? null,
    telInternacional: p.internationalPhoneNumber ?? null,
    web: p.websiteUri ?? null,
    valoracion: typeof p.rating === 'number' ? p.rating : null,
    numResenas: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
    mapsUrl: p.googleMapsUri ?? null,
    estadoNegocio: p.businessStatus ?? null,
  };
}
