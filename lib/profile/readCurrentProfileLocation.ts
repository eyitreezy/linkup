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

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  let label = '';
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    label = formatGeocodedAddress(places[0]) || '';
  } catch {
    label = '';
  }
  if (!label.trim()) {
    label = formatCoords(pos.coords.latitude, pos.coords.longitude);
  }

  return {
    locationLabel: label,
    locationLatitude: pos.coords.latitude,
    locationLongitude: pos.coords.longitude,
  };
}
