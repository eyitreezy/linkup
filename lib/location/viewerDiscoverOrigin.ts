/** Normalize profile / GPS values that may arrive as strings from storage or JSON. */
export function normalizeViewerCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function viewerDiscoverOriginReady(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null;
}

export function resolveDiscoverViewerOrigin(opts: {
  deviceLat?: unknown;
  deviceLng?: unknown;
  profileLat?: unknown;
  profileLng?: unknown;
  canTravelMode: boolean;
  travelLat?: unknown;
  travelLng?: unknown;
  /** When set, travel coords apply only if the travel pin is fully configured. */
  travelLabel?: string | null;
}): { lat: number | null; lng: number | null } {
  const userLat =
    normalizeViewerCoordinate(opts.deviceLat) ?? normalizeViewerCoordinate(opts.profileLat);
  const userLng =
    normalizeViewerCoordinate(opts.deviceLng) ?? normalizeViewerCoordinate(opts.profileLng);

  if (opts.canTravelMode) {
    const travelLat = normalizeViewerCoordinate(opts.travelLat);
    const travelLng = normalizeViewerCoordinate(opts.travelLng);
    const travelActive = (opts.travelLabel?.trim().length ?? 0) > 0;
    if (travelActive && travelLat != null && travelLng != null) {
      return { lat: travelLat, lng: travelLng };
    }
  }

  return { lat: userLat, lng: userLng };
}
