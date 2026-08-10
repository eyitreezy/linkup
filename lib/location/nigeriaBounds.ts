/** Approximate bounding box for Nigeria (lat/lng sanity check). */
export function isCoordinateInNigeria(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 4.2 && lat <= 13.9 && lng >= 2.7 && lng <= 14.7;
}

export const NIGERIA_LOCATION_REJECTED_MESSAGE =
  'LinkUp location search is limited to Nigeria. Pick a city or area in Nigeria.';
