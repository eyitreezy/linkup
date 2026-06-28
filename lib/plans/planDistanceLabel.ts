export type PlanDistanceLabelStyle = 'pill' | 'line';

export function planHasMeetupCoords(plan: {
  latitude: number | null;
  longitude: number | null;
}): boolean {
  return (
    typeof plan.latitude === 'number' &&
    Number.isFinite(plan.latitude) &&
    typeof plan.longitude === 'number' &&
    Number.isFinite(plan.longitude)
  );
}

/** User-facing distance copy on discover / plan cards. */
export function formatPlanDistanceLabel(opts: {
  distanceKm: number | null;
  viewerHasLocation: boolean;
  planHasLocation: boolean;
  style?: PlanDistanceLabelStyle;
}): string {
  const { distanceKm, viewerHasLocation, planHasLocation, style = 'pill' } = opts;

  if (distanceKm != null && Number.isFinite(distanceKm)) {
    if (distanceKm < 1) {
      return style === 'line' ? '< 1 km away' : 'Near you';
    }
    return style === 'line' ? `${distanceKm.toFixed(1)} km away` : `${distanceKm.toFixed(1)} km`;
  }

  if (!viewerHasLocation) return 'Enable location';
  if (!planHasLocation) return 'Nearby';
  return 'Nearby';
}
