/** ISO 3166-1 alpha-2 codes for African countries — restrict location search to Africa. */
export const AFRICA_COUNTRY_CODES = [
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ',
  'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG',
  'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO',
  'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW',
] as const;

/** Lowercase codes for Google Places `componentRestrictions.country` (max 5 per request). */
export const AFRICA_COUNTRY_CODES_LOWER = AFRICA_COUNTRY_CODES.map((c) => c.toLowerCase());

/** Comma-separated list for Nominatim `countrycodes`. */
export const NOMINATIM_AFRICA_COUNTRYCODES = AFRICA_COUNTRY_CODES_LOWER.join(',');

/** Approximate bounding box for Africa (lat/lng sanity check). */
export const AFRICA_BOUNDS = {
  minLat: -35.5,
  maxLat: 37.5,
  minLng: -25.0,
  maxLng: 55.0,
};

export function isCoordinateInAfrica(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= AFRICA_BOUNDS.minLat &&
    lat <= AFRICA_BOUNDS.maxLat &&
    lng >= AFRICA_BOUNDS.minLng &&
    lng <= AFRICA_BOUNDS.maxLng
  );
}

export const AFRICA_LOCATION_REJECTED_MESSAGE =
  'LinkUp location search is limited to Africa. Pick a place within the continent.';
