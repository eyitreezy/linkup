/**
 * Forward / reverse geocoding helpers (expo-location).
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type LocationSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
  /** Google Places — resolve coords on select if lat/lng are 0. */
  placeId?: string;
};

export function formatGeocodedAddress(a: Location.LocationGeocodedAddress | null | undefined): string {
  if (!a) return '';
  if (Platform.OS === 'android' && a.formattedAddress?.trim()) return a.formattedAddress.trim();
  const street =
    a.streetNumber && a.street ? `${a.streetNumber} ${a.street}` : a.street || a.name || '';
  const parts = [street, a.district, a.city, a.region, a.country].filter(
    (x): x is string => Boolean(x && String(x).trim())
  );
  const uniq = [...new Set(parts)];
  return uniq.slice(0, 3).join(', ');
}

/** Geocode a free-text query into labeled suggestions (deduped by label). */
export async function searchLocationSuggestions(
  query: string,
  limit = 8
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length <= 2) return [];

  try {
    const { searchGooglePlaceSuggestions } = await import('@/lib/location/placesAutocomplete');
    const fromGoogle = await searchGooglePlaceSuggestions(trimmed, limit);
    if (fromGoogle.length > 0) return fromGoogle;
  } catch (e) {
    if (__DEV__) console.warn('[location] Google Places:', e instanceof Error ? e.message : e);
  }

  let results: Location.LocationGeocodedLocation[] = [];
  try {
    results = await Location.geocodeAsync(trimmed);
  } catch (e) {
    if (__DEV__) console.warn('[location] geocodeAsync:', e instanceof Error ? e.message : e);
    return [];
  }

  const top = results.slice(0, limit);
  const seen = new Set<string>();

  const labeled = await Promise.all(
    top.map(async (r, i) => {
      let label = '';
      try {
        const [addr] = await Location.reverseGeocodeAsync({
          latitude: r.latitude,
          longitude: r.longitude,
        });
        label = formatGeocodedAddress(addr);
      } catch {
        label = '';
      }
      if (!label) {
        label = i === 0 ? trimmed : `${trimmed} (${i + 1})`;
      }
      return { label, latitude: r.latitude, longitude: r.longitude };
    })
  );

  const out: LocationSuggestion[] = [];
  for (const item of labeled) {
    const key = item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
