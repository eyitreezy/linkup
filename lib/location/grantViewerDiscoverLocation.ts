import { withAsyncTimeout } from '@/lib/location/withAsyncTimeout';
import { saveCachedViewerCoords } from '@/lib/location/viewerCoordsCache';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

const GRANT_BUDGET_MS = 18_000;
const PERMISSION_TIMEOUT_MS = 5_000;
const LAST_KNOWN_TIMEOUT_MS = 4_000;
const CURRENT_POSITION_TIMEOUT_MS = 10_000;

export type GrantViewerLocationResult =
  | { ok: true; lat: number; lng: number; label: string; permission: Location.PermissionStatus }
  | {
      ok: false;
      permission: Location.PermissionStatus;
      reason: 'denied' | 'unavailable' | 'timeout' | 'services_disabled';
    };

function isValidCoords(coords: { latitude: number; longitude: number } | undefined | null): boolean {
  return (
    coords != null &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
}

async function prepareAndroidLocation(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await withAsyncTimeout(
    () => Location.enableNetworkProviderAsync().catch(() => undefined) as Promise<void>,
    3_000,
    undefined
  );
}

async function readOneDeviceFix(): Promise<{ latitude: number; longitude: number } | null> {
  await prepareAndroidLocation();

  const lastAttempts: Array<Location.LocationLastKnownOptions | undefined> = [
    { maxAge: 60 * 60 * 1000 },
    undefined,
  ];

  for (const options of lastAttempts) {
    const last = await withAsyncTimeout(
      () =>
        options
          ? Location.getLastKnownPositionAsync(options)
          : Location.getLastKnownPositionAsync(),
      LAST_KNOWN_TIMEOUT_MS,
      null
    );
    if (last && isValidCoords(last.coords)) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
  }

  const accuracies = [
    Location.Accuracy.Lowest,
    Location.Accuracy.Low,
    Location.Accuracy.Balanced,
  ];

  for (const accuracy of accuracies) {
    const current = await withAsyncTimeout(
      () =>
        Location.getCurrentPositionAsync({
          accuracy,
          mayShowUserSettingsDialog: accuracy === Location.Accuracy.Lowest,
        }),
      CURRENT_POSITION_TIMEOUT_MS,
      null
    );
    if (current && isValidCoords(current.coords)) {
      return { latitude: current.coords.latitude, longitude: current.coords.longitude };
    }
  }

  return null;
}

let grantInFlight: Promise<GrantViewerLocationResult> | null = null;

async function runGrantViewerDiscoverLocation(opts?: {
  requestPermission?: boolean;
}): Promise<GrantViewerLocationResult> {
  const requestPermission = opts?.requestPermission ?? true;

  return withAsyncTimeout(
    async () => {
      let permissionResponse = await withAsyncTimeout(
        () => Location.getForegroundPermissionsAsync(),
        PERMISSION_TIMEOUT_MS,
        null
      );
      if (!permissionResponse) {
        return { ok: false as const, permission: 'undetermined' as const, reason: 'timeout' as const };
      }

      let permission = permissionResponse.status;
      if (permission !== 'granted' && requestPermission) {
        const requested = await withAsyncTimeout(
          () => Location.requestForegroundPermissionsAsync(),
          PERMISSION_TIMEOUT_MS,
          null
        );
        if (!requested) {
          return { ok: false as const, permission, reason: 'timeout' as const };
        }
        permission = requested.status;
      }

      if (permission !== 'granted') {
        return { ok: false as const, permission, reason: 'denied' as const };
      }

      const servicesEnabled = await withAsyncTimeout(
        () => Location.hasServicesEnabledAsync(),
        3_000,
        false
      );
      if (servicesEnabled === false) {
        if (__DEV__) {
          console.warn('[Discover] grantViewerDiscoverLocation: device location services off');
        }
        return { ok: false as const, permission, reason: 'services_disabled' as const };
      }

      const coords = await readOneDeviceFix();
      if (!coords) {
        if (__DEV__) {
          console.warn(
            '[Discover] grantViewerDiscoverLocation: no device fix — pick your city below or set a mock location on the emulator'
          );
        }
        return { ok: false as const, permission, reason: 'unavailable' as const };
      }

      if (__DEV__) {
        console.info('[Discover] grantViewerDiscoverLocation: device fix', coords);
      }

      void saveCachedViewerCoords(coords.latitude, coords.longitude);
      return {
        ok: true as const,
        lat: coords.latitude,
        lng: coords.longitude,
        label: 'Near you',
        permission,
      };
    },
    GRANT_BUDGET_MS,
    { ok: false as const, permission: 'undetermined' as const, reason: 'timeout' as const }
  );
}

/**
 * Modal "Allow / Use my location" — permission + one bounded GPS read.
 */
export async function grantViewerDiscoverLocation(opts?: {
  requestPermission?: boolean;
}): Promise<GrantViewerLocationResult> {
  if (grantInFlight) {
    return grantInFlight;
  }

  grantInFlight = runGrantViewerDiscoverLocation(opts).finally(() => {
    grantInFlight = null;
  });
  return grantInFlight;
}
