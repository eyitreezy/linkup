import { readGpsCoords } from '@/lib/location/readGpsCoords';
import { formatGeocodedAddress } from '@/lib/location/locationGeocode';
import type { ProfileLocationPatch } from '@/lib/profile/profileLocation';
import * as Location from 'expo-location';

function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
}

/** GPS + reverse geocode for profile / onboarding location (editable after fill). */
export async function readCurrentProfileLocation(): Promise<ProfileLocationPatch | null> {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    const req = await Location.requestForegroundPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const coords = await readGpsCoords();
  if (!coords) return null;

  let label = '';
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    label = formatGeocodedAddress(places[0]) || '';
  } catch {
    label = '';
  }
  if (!label.trim()) {
    label = formatCoords(coords.latitude, coords.longitude);
  }

  return {
    locationLabel: label,
    locationLatitude: coords.latitude,
    locationLongitude: coords.longitude,
  };
}
