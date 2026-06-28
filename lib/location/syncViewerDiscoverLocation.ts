import { formatGeocodedAddress } from '@/lib/location/locationGeocode';
import { readGpsCoords } from '@/lib/location/readGpsCoords';
import * as Location from 'expo-location';

export type ViewerDiscoverLocation = {
  lat: number;
  lng: number;
  cityLabel: string;
};

/** Resolve viewer GPS for Discover sorting and distance badges (permission must already be granted). */
export async function resolveViewerDiscoverLocation(): Promise<ViewerDiscoverLocation | null> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return null;

  const coords = await readGpsCoords();
  if (!coords) return null;

  const { latitude: lat, longitude: lng } = coords;

  let cityLabel = 'Near you';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const label = formatGeocodedAddress(places[0]);
    if (label.trim().length > 0) cityLabel = label;
  } catch {
    /* keep Near you */
  }

  return { lat, lng, cityLabel };
}
