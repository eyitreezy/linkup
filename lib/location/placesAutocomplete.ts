/**
 * Google Places Autocomplete (when Maps API key is configured).
 * Africa-only; addresses + establishments (restaurants, venues, landmarks).
 */
import {
  AFRICA_COUNTRY_CODES_LOWER,
  AFRICA_LOCATION_REJECTED_MESSAGE,
  isCoordinateInAfrica,
} from '@/lib/location/africaCountries';
import { getMapsApiKeyForCurrentPlatform } from '@/lib/mapsConfig';
import type { LocationSuggestion } from '@/lib/location/locationGeocode';

type AutocompleteResponse = {
  status: string;
  predictions?: { description: string; place_id: string }[];
  error_message?: string;
};

type PlaceDetailsResponse = {
  status: string;
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
  error_message?: string;
};

/** Lagos — center bias for Africa-wide search. */
const AFRICA_SEARCH_BIAS = '6.5244,3.3792';
const AFRICA_SEARCH_RADIUS_M = '8000000';

function africaComponentRestrictions(): string {
  return AFRICA_COUNTRY_CODES_LOWER.slice(0, 5)
    .map((c) => `country:${c}`)
    .join('|');
}

async function fetchGooglePredictions(
  query: string,
  key: string,
  types?: string
): Promise<{ description: string; place_id: string }[]> {
  const params = new URLSearchParams({
    input: query,
    key,
    location: AFRICA_SEARCH_BIAS,
    radius: AFRICA_SEARCH_RADIUS_M,
    components: africaComponentRestrictions(),
  });
  if (types) params.set('types', types);

  const autoUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
  const autoRes = await fetch(autoUrl);
  const autoJson = (await autoRes.json()) as AutocompleteResponse;

  if (autoJson.status !== 'OK' && autoJson.status !== 'ZERO_RESULTS') {
    if (__DEV__) {
      console.warn('[places] autocomplete:', autoJson.status, autoJson.error_message);
    }
    return [];
  }

  return autoJson.predictions ?? [];
}

export async function searchGooglePlaceSuggestions(
  query: string,
  limit = 8
): Promise<LocationSuggestion[]> {
  const key = getMapsApiKeyForCurrentPlatform().trim();
  if (!key) return [];

  const trimmed = query.trim();
  if (trimmed.length <= 2) return [];

  const [general, establishments] = await Promise.all([
    fetchGooglePredictions(trimmed, key),
    fetchGooglePredictions(trimmed, key, 'establishment'),
  ]);

  const seen = new Set<string>();
  const merged: { description: string; place_id: string }[] = [];
  for (const row of [...establishments, ...general]) {
    if (seen.has(row.place_id)) continue;
    seen.add(row.place_id);
    merged.push(row);
    if (merged.length >= limit) break;
  }

  return merged.slice(0, limit).map((p) => ({
    label: p.description,
    latitude: 0,
    longitude: 0,
    placeId: p.place_id,
  }));
}

/** Resolve lat/lng when the user picks a Places autocomplete row. */
export async function resolveGooglePlaceSuggestion(
  suggestion: LocationSuggestion
): Promise<LocationSuggestion> {
  if (
    suggestion.latitude !== 0 &&
    suggestion.longitude !== 0 &&
    isCoordinateInAfrica(suggestion.latitude, suggestion.longitude)
  ) {
    return suggestion;
  }

  if (suggestion.placeId?.startsWith('osm:')) {
    if (!isCoordinateInAfrica(suggestion.latitude, suggestion.longitude)) {
      throw new Error(AFRICA_LOCATION_REJECTED_MESSAGE);
    }
    return suggestion;
  }

  if (!suggestion.placeId) {
    if (!isCoordinateInAfrica(suggestion.latitude, suggestion.longitude)) {
      throw new Error(AFRICA_LOCATION_REJECTED_MESSAGE);
    }
    return suggestion;
  }

  const key = getMapsApiKeyForCurrentPlatform().trim();
  if (!key) return suggestion;

  const detailsUrl =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(suggestion.placeId)}` +
    `&fields=formatted_address,geometry` +
    `&key=${encodeURIComponent(key)}`;
  const detRes = await fetch(detailsUrl);
  const detJson = (await detRes.json()) as PlaceDetailsResponse;
  const loc = detJson.result?.geometry?.location;
  if (!loc) return suggestion;

  if (!isCoordinateInAfrica(loc.lat, loc.lng)) {
    throw new Error(AFRICA_LOCATION_REJECTED_MESSAGE);
  }

  return {
    label: detJson.result?.formatted_address?.trim() || suggestion.label,
    latitude: loc.lat,
    longitude: loc.lng,
    placeId: suggestion.placeId,
  };
}
