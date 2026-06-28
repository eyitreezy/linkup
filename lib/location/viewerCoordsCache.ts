import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeViewerCoordinate } from '@/lib/location/viewerDiscoverOrigin';

const VIEWER_COORDS_CACHE_KEY = 'linkup_viewer_coords_v1';

export type CachedViewerCoords = {
  lat: number;
  lng: number;
  savedAt: number;
};

export async function loadCachedViewerCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(VIEWER_COORDS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedViewerCoords>;
    const lat = normalizeViewerCoordinate(parsed.lat);
    const lng = normalizeViewerCoordinate(parsed.lng);
    if (lat == null || lng == null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function saveCachedViewerCoords(lat: number, lng: number): Promise<void> {
  const payload: CachedViewerCoords = { lat, lng, savedAt: Date.now() };
  await AsyncStorage.setItem(VIEWER_COORDS_CACHE_KEY, JSON.stringify(payload));
}
