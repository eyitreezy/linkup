import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { distanceKm } from '@/lib/location';
import { isCreatorSpotlightActive } from '@/lib/plans/creatorSpotlight';
import type { SubscriptionTier } from '@/types/database';

export type RankDiscoveryOptions = {
  effectiveLat: number | null;
  effectiveLng: number | null;
  now?: Date;
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

/**
 * Mood plans first (soonest expiry), then host tier, creator spotlight, boost, distance, recency.
 */
export function rankDiscoveryPlans(
  rows: PlanFeedRow[],
  opts?: RankDiscoveryOptions
): PlanFeedRow[] {
  const now = opts?.now ?? new Date();
  const nowMs = now.getTime();
  const lat = opts?.effectiveLat ?? null;
  const lng = opts?.effectiveLng ?? null;

  const isBoosted = (p: PlanFeedRow) =>
    !!(p.boosted_until && new Date(p.boosted_until).getTime() > nowMs);
  const moodDeadline = (p: PlanFeedRow) =>
    p.is_mood_plan && p.mood_expires_at ? new Date(p.mood_expires_at).getTime() : Infinity;

  return [...rows].sort((a, b) => {
    if (a.is_mood_plan !== b.is_mood_plan) return a.is_mood_plan ? -1 : 1;
    if (a.is_mood_plan && b.is_mood_plan) {
      const ma = moodDeadline(a);
      const mb = moodDeadline(b);
      if (ma !== mb) return ma - mb;
    }

    const tierA = tierRankForRow(a);
    const tierB = tierRankForRow(b);
    if (tierA !== tierB) return tierB - tierA;

    const aSpotlighted = isCreatorSpotlightActive(a.creatorProfile?.spotlight_until, now);
    const bSpotlighted = isCreatorSpotlightActive(b.creatorProfile?.spotlight_until, now);
    if (aSpotlighted !== bSpotlighted) return bSpotlighted ? 1 : -1;

    const ba = isBoosted(a) ? 1 : 0;
    const bb = isBoosted(b) ? 1 : 0;
    if (ba !== bb) return bb - ba;

    if (lat != null && lng != null) {
      if (a.latitude == null || a.longitude == null) return 1;
      if (b.latitude == null || b.longitude == null) return -1;
      const da = distanceKm(lat, lng, a.latitude, a.longitude);
      const db = distanceKm(lat, lng, b.latitude, b.longitude);
      if (da !== db) return da - db;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
