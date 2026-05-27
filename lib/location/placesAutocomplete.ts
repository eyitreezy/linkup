/**
 * Google Places Autocomplete (when Maps API key is configured).
 */
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

export async function searchGooglePlaceSuggestions(
  query: string,
  limit = 8
): Promise<LocationSuggestion[]> {
  const key = getMapsApiKeyForCurrentPlatform().trim();
  if (!key) return [];

  const trimmed = query.trim();
  if (trimmed.length <= 2) return [];

  const autoUrl =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(trimmed)}` +
    `&key=${encodeURIComponent(key)}`;

  const autoRes = await fetch(autoUrl);
  const autoJson = (await autoRes.json()) as AutocompleteResponse;

  if (autoJson.status !== 'OK' && autoJson.status !== 'ZERO_RESULTS') {
    if (__DEV__) {
      console.warn('[places] autocomplete:', autoJson.status, autoJson.error_message);
    }
    return [];
  }

  return (autoJson.predictions ?? []).slice(0, limit).map((p) => ({
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
  if (suggestion.latitude !== 0 && suggestion.longitude !== 0) {
    return suggestion;
  }
  if (!suggestion.placeId) return suggestion;

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

  return {
    label: detJson.result?.formatted_address?.trim() || suggestion.label,
    latitude: loc.lat,
    longitude: loc.lng,
    placeId: suggestion.placeId,
  };
}
