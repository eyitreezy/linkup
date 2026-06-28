import { formatGeocodedAddress } from '@/lib/location/locationGeocode';
import { readGpsCoords, readQuickDeviceCoords } from '@/lib/location/readGpsCoords';
import { saveCachedViewerCoords } from '@/lib/location/viewerCoordsCache';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type ActivatedViewerLocation = {
  lat: number;
  lng: number;
  cityLabel: string;
};

export type ActivationResult =
  | { ok: true; location: ActivatedViewerLocation; permission: Location.PermissionStatus }
  | { ok: false; permission: Location.PermissionStatus; reason: 'denied' | 'unavailable' | 'timeout' };

const ACTIVATION_DEADLINE_MS = 22_000;
const GEOCODE_TIMEOUT_MS = 4_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

async function reverseGeocodeLabel(lat: number, lng: number): Promise<string> {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const label = formatGeocodedAddress(places[0]);
    if (label.trim().length > 0) return label;
  } catch {
    /* fall through */
  }
  return 'Near you';
}

async function runActivation(opts?: {
  requestPermission?: boolean;
  preferQuickRead?: boolean;
}): Promise<ActivationResult> {
  const requestPermission = opts?.requestPermission ?? false;
  const preferQuickRead = opts?.preferQuickRead ?? false;

  let permission = (await Location.getForegroundPermissionsAsync()).status;
  if (permission !== 'granted' && requestPermission) {
    permission = (await Location.requestForegroundPermissionsAsync()).status;
  }

  if (permission !== 'granted') {
    return { ok: false, permission, reason: 'denied' };
  }

  if (Platform.OS === 'android' && requestPermission) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const coords = preferQuickRead ? await readQuickDeviceCoords() : await readGpsCoords();
  if (!coords) {
    return { ok: false, permission, reason: 'unavailable' };
  }

  const cityLabel =
    (await withTimeout(reverseGeocodeLabel(coords.latitude, coords.longitude), GEOCODE_TIMEOUT_MS)) ??
    'Near you';

  const location = { lat: coords.latitude, lng: coords.longitude, cityLabel };
  void saveCachedViewerCoords(location.lat, location.lng);
  return { ok: true, location, permission };
}

/**
 * Request foreground permission (if needed) and resolve the viewer's GPS fix.
 * Hard deadline so UI never spins indefinitely.
 */
export async function activateViewerLocation(opts?: {
  requestPermission?: boolean;
  preferQuickRead?: boolean;
}): Promise<ActivationResult> {
  const result = await withTimeout(runActivation(opts), ACTIVATION_DEADLINE_MS);
  if (!result) {
    const permission = (await Location.getForegroundPermissionsAsync()).status;
    return { ok: false, permission, reason: 'timeout' };
  }
  return result;
}
