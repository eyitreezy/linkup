import type { FeedFilterState } from '@/components/plans/PlansFilterSheet';
import { distanceMeters } from '@/lib/location';

type PlanCoords = {
  latitude: number | null;
  longitude: number | null;
  creator_id?: string;
};

/** True only when the user explicitly applied a max-distance filter. */
export function isDistanceFilterActive(
  filter: Pick<FeedFilterState, 'distanceFilterActive' | 'maxDistanceKm'>
): boolean {
  return (
    filter.distanceFilterActive === true &&
    typeof filter.maxDistanceKm === 'number' &&
    Number.isFinite(filter.maxDistanceKm) &&
    filter.maxDistanceKm > 0
  );
}

/** Max km used when enforcing the discover distance filter. */
export function resolveDiscoverMaxDistanceKm(
  filter: Pick<FeedFilterState, 'maxDistanceKm'>,
  baseRadiusKm: number,
  active: boolean
): number {
  if (!active) return baseRadiusKm;
  return filter.maxDistanceKm ?? baseRadiusKm;
}

/**
 * Whether a plan is within the viewer's max-distance filter.
 * When strict, plans or viewers without coordinates fail (exclude unknown distance).
 */
export function planWithinMaxDistanceKm(
  plan: PlanCoords,
  viewerUserId: string | null,
  viewerLat: number | null,
  viewerLng: number | null,
  maxKm: number,
  strict = true,
  includeOwnPlans = true
): boolean {
  if (includeOwnPlans && viewerUserId && plan.creator_id === viewerUserId) return true;

  if (plan.latitude == null || plan.longitude == null) {
    return !strict;
  }
  if (viewerLat == null || viewerLng == null) {
    return !strict;
  }

  const dM = distanceMeters(viewerLat, viewerLng, plan.latitude, plan.longitude);
  return dM <= maxKm * 1000;
}

export function filterDiscoverRowsByDistance<T extends PlanCoords & { creator_id: string }>(
  rows: T[],
  active: boolean,
  maxKm: number,
  viewerUserId: string | null,
  viewerLat: number | null,
  viewerLng: number | null
): T[] {
  if (!active) return rows;
  return rows.filter((row) =>
    planWithinMaxDistanceKm(row, viewerUserId, viewerLat, viewerLng, maxKm, true, false)
  );
}

/** Nearest-within-range first — meters ascending. */
export function sortDiscoverByDistanceAsc<T extends PlanCoords>(
  rows: T[],
  viewerLat: number,
  viewerLng: number
): T[] {
  const distOf = (row: PlanCoords) =>
    row.latitude != null && row.longitude != null
      ? distanceMeters(viewerLat, viewerLng, row.latitude, row.longitude)
      : Number.POSITIVE_INFINITY;

  return [...rows].sort((a, b) => {
    const da = distOf(a);
    const db = distOf(b);
    if (da !== db) return da - db;
    return 0;
  });
}
