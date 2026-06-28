import * as Location from 'expo-location';
import { Platform } from 'react-native';

const LAST_KNOWN_TIMEOUT_MS = 4_000;
const CURRENT_POSITION_TIMEOUT_MS = 10_000;
const WATCH_TIMEOUT_MS = 8_000;
const NETWORK_PROVIDER_TIMEOUT_MS = 3_000;

function isValidCoords(coords: { latitude: number; longitude: number } | undefined | null): boolean {
  return (
    coords != null &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
}

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

async function prepareAndroidProviders(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await withTimeout(
    Location.enableNetworkProviderAsync().catch(() => undefined) as Promise<void>,
    NETWORK_PROVIDER_TIMEOUT_MS
  );
}

async function readLastKnownPosition(): Promise<Location.LocationObject | null> {
  const attempts: Array<Location.LocationLastKnownOptions | undefined> = [
    { maxAge: 60 * 60 * 1000 },
    { maxAge: 15 * 60 * 1000 },
    undefined,
  ];

  for (const options of attempts) {
    const last = await withTimeout(
      options
        ? Location.getLastKnownPositionAsync(options)
        : Location.getLastKnownPositionAsync(),
      LAST_KNOWN_TIMEOUT_MS
    );
    if (last && isValidCoords(last.coords)) return last;
  }
  return null;
}

async function readFreshPosition(): Promise<Location.LocationObject | null> {
  const accuracies = [Location.Accuracy.Lowest, Location.Accuracy.Low, Location.Accuracy.Balanced];

  for (const accuracy of accuracies) {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy,
        mayShowUserSettingsDialog: true,
      }),
      CURRENT_POSITION_TIMEOUT_MS
    );
    if (pos && isValidCoords(pos.coords)) return pos;
  }
  return null;
}

async function readPositionViaWatch(): Promise<Location.LocationObject | null> {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: Location.LocationSubscription | null = null;

    const finish = (value: Location.LocationObject | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void subscription?.remove();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), WATCH_TIMEOUT_MS);

    void (async () => {
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Low,
            mayShowUserSettingsDialog: true,
            timeInterval: 1000,
            distanceInterval: 0,
          },
          (pos) => {
            if (isValidCoords(pos.coords)) finish(pos);
          },
          () => {
            /* wait for fix or timeout */
          }
        );
      } catch {
        finish(null);
      }
    })();
  });
}

/** Fast read used by the Allow button — last known, then one quick current fix. */
export async function readQuickDeviceCoords(): Promise<{ latitude: number; longitude: number } | null> {
  const last = await readLastKnownPosition();
  if (last) {
    return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  }

  const fresh = await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
      mayShowUserSettingsDialog: true,
    }),
    CURRENT_POSITION_TIMEOUT_MS
  );
  if (fresh && isValidCoords(fresh.coords)) {
    return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
  }
  return null;
}

/** Best-effort device coordinates; foreground permission must already be granted. */
export async function readGpsCoords(): Promise<{ latitude: number; longitude: number } | null> {
  const quick = await readQuickDeviceCoords();
  if (quick) return quick;

  await prepareAndroidProviders();

  const fresh = await readFreshPosition();
  if (fresh) {
    return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
  }

  const watched = await readPositionViaWatch();
  if (watched) {
    return { latitude: watched.coords.latitude, longitude: watched.coords.longitude };
  }

  return null;
}
