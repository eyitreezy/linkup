import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { distanceMeters } from '@/lib/location';
import { isCreatorSpotlightActive } from '@/lib/plans/creatorSpotlight';
import { isPlanBoostActive } from '@/lib/plans/planBoost';
import type { SubscriptionTier } from '@/types/database';

export type RankDiscoveryOptions = {
  effectiveLat: number | null;
  effectiveLng: number | null;
  now?: Date;
  /** Strict nearest-first (meters) — default discover sort when viewer has a location. */
  sortDistanceAscending?: boolean;
};

function tierRankForRow(row: PlanFeedRow): number {
  if (row.host_tier_rank != null && row.host_tier_rank > 0) return row.host_tier_rank;
  const tier = (row.host_tier ?? row.creatorProfile?.subscription_badge ?? 'FREE') as SubscriptionTier;
  switch (tier) {
    case 'PLATINUM':
      return 3;
    case 'GOLD':
      return 2;
    case 'SILVER':
      return 1;
    default:
      return 0;
  }
}

function rowDistanceMeters(
  row: PlanFeedRow,
  lat: number | null,
  lng: number | null
): number {
  if (lat == null || lng == null || row.latitude == null || row.longitude == null) {
    return Number.POSITIVE_INFINITY;
  }
  return distanceMeters(lat, lng, row.latitude, row.longitude);
}

function compareDistanceAsc(
  a: PlanFeedRow,
  b: PlanFeedRow,
  lat: number | null,
  lng: number | null
): number {
  const da = rowDistanceMeters(a, lat, lng);
  const db = rowDistanceMeters(b, lat, lng);
  if (da !== db) return da - db;
  return 0;
}

function compareRecencyDesc(a: PlanFeedRow, b: PlanFeedRow): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** Boost, creator spotlight, or paid host tier — overrides organic distance ordering. */
function isPromotionLaneRow(row: PlanFeedRow, now: Date): boolean {
  if (isPlanBoostActive(row.boosted_until)) return true;
  if (isCreatorSpotlightActive(row.creatorProfile?.spotlight_until, now)) return true;
  return tierRankForRow(row) > 0;
}

function comparePromotionLane(
  a: PlanFeedRow,
  b: PlanFeedRow,
  lat: number | null,
  lng: number | null,
  now: Date
): number {
  const ba = isPlanBoostActive(a.boosted_until) ? 1 : 0;
  const bb = isPlanBoostActive(b.boosted_until) ? 1 : 0;
  if (ba !== bb) return bb - ba;

  const aSpot = isCreatorSpotlightActive(a.creatorProfile?.spotlight_until, now) ? 1 : 0;
  const bSpot = isCreatorSpotlightActive(b.creatorProfile?.spotlight_until, now) ? 1 : 0;
  if (aSpot !== bSpot) return bSpot - aSpot;

  const tierA = tierRankForRow(a);
  const tierB = tierRankForRow(b);
  if (tierA !== tierB) return tierB - tierA;

  const distCmp = compareDistanceAsc(a, b, lat, lng);
  if (distCmp !== 0) return distCmp;

  return compareRecencyDesc(a, b);
}

/**
 * Swipe / list deck: nearest-first (meters) when the viewer has a location;
 * otherwise promotion lane then recency. Mood plans use rankMoodTimelinePlans.
 */
export function rankDiscoveryPlans(
  rows: PlanFeedRow[],
  opts?: RankDiscoveryOptions
): PlanFeedRow[] {
  const now = opts?.now ?? new Date();
  const lat = opts?.effectiveLat ?? null;
  const lng = opts?.effectiveLng ?? null;
  const sortByNearness = opts?.sortDistanceAscending ?? (lat != null && lng != null);

  return [...rows].sort((a, b) => {
    if (sortByNearness && lat != null && lng != null) {
      const distCmp = compareDistanceAsc(a, b, lat, lng);
      if (distCmp !== 0) return distCmp;
      return compareRecencyDesc(a, b);
    }

    const promoA = isPromotionLaneRow(a, now);
    const promoB = isPromotionLaneRow(b, now);
    if (promoA !== promoB) return promoA ? -1 : 1;

    if (promoA) return comparePromotionLane(a, b, lat, lng, now);

    const distCmp = compareDistanceAsc(a, b, lat, lng);
    if (distCmp !== 0) return distCmp;

    return compareRecencyDesc(a, b);
  });
}

/** Mood timeline carousel: soonest expiry first, then distance (meters), then recency. */
export function rankMoodTimelinePlans(
  rows: PlanFeedRow[],
  opts?: Pick<RankDiscoveryOptions, 'effectiveLat' | 'effectiveLng'>
): PlanFeedRow[] {
  const lat = opts?.effectiveLat ?? null;
  const lng = opts?.effectiveLng ?? null;

  const moodDeadline = (p: PlanFeedRow) =>
    p.mood_expires_at ? new Date(p.mood_expires_at).getTime() : Number.POSITIVE_INFINITY;

  return [...rows].sort((a, b) => {
    const ma = moodDeadline(a);
    const mb = moodDeadline(b);
    if (ma !== mb) return ma - mb;

    const distCmp = compareDistanceAsc(a, b, lat, lng);
    if (distCmp !== 0) return distCmp;

    return compareRecencyDesc(a, b);
  });
}
