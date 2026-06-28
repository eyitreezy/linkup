import { grantViewerDiscoverLocation } from '@/lib/location/grantViewerDiscoverLocation';
import { loadCachedViewerCoords } from '@/lib/location/viewerCoordsCache';
import { normalizeViewerCoordinate } from '@/lib/location/viewerDiscoverOrigin';
import * as Location from 'expo-location';

export type ResolvedViewerLocation = {
  lat: number;
  lng: number;
  label: string;
  source: 'profile' | 'cache' | 'device';
};

export type ResolveDiscoverViewerLocationResult =
  | {
      ok: true;
      location: ResolvedViewerLocation;
      permission: Location.PermissionStatus;
    }
  | {
      ok: false;
      permission: Location.PermissionStatus;
      reason: 'denied' | 'unavailable' | 'timeout' | 'services_disabled';
    };

/** Profile → device cache → GPS (optional permission request). */
export async function resolveDiscoverViewerLocation(opts?: {
  profileLat?: unknown;
  profileLng?: unknown;
  profileLabel?: string | null;
  requestPermission?: boolean;
}): Promise<ResolveDiscoverViewerLocationResult> {
  const permission = (await Location.getForegroundPermissionsAsync()).status;

  const profileLat = normalizeViewerCoordinate(opts?.profileLat);
  const profileLng = normalizeViewerCoordinate(opts?.profileLng);
  if (profileLat != null && profileLng != null) {
    return {
      ok: true,
      location: {
        lat: profileLat,
        lng: profileLng,
        label: opts?.profileLabel?.trim() || 'Near you',
        source: 'profile',
      },
      permission,
    };
  }

  const cached = await loadCachedViewerCoords();
  if (cached) {
    return {
      ok: true,
      location: {
        lat: cached.lat,
        lng: cached.lng,
        label: 'Near you',
        source: 'cache',
      },
      permission,
    };
  }

  const grant = await grantViewerDiscoverLocation({
    requestPermission: opts?.requestPermission ?? true,
  });

  if (!grant.ok) {
    return { ok: false, permission: grant.permission, reason: grant.reason };
  }

  return {
    ok: true,
    location: {
      lat: grant.lat,
      lng: grant.lng,
      label: grant.label,
      source: 'device',
    },
    permission: grant.permission,
  };
}
