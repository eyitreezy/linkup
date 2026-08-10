import { isCoordinateInNigeria } from '@/lib/location/nigeriaBounds';
import type { LocationSuggestion } from '@/lib/location/locationGeocode';

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  place_id?: number;
};

const NOMINATIM_USER_AGENT = 'LinkUp-Mobile/1.0 (location search; Nigeria-only)';

/** OpenStreetMap Nominatim — Nigeria-only fallback with POI + address support. */
export async function searchNominatimSuggestions(
  query: string,
  limit = 8
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: String(Math.min(Math.max(limit, 1), 10)),
    addressdetails: '0',
    countrycodes: 'ng',
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) return [];

    const rows = (await res.json()) as NominatimResult[];
    return rows.flatMap((row) => {
      const label = row.display_name?.trim();
      const latitude = row.lat != null ? Number(row.lat) : NaN;
      const longitude = row.lon != null ? Number(row.lon) : NaN;
      if (
        !label ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !isCoordinateInNigeria(latitude, longitude)
      ) {
        return [];
      }

      return [
        {
          label,
          latitude,
          longitude,
          placeId: row.place_id != null ? `osm:${row.place_id}` : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}
