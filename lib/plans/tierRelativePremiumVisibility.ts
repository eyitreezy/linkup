import { distanceKm } from '@/lib/location';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { tierRank } from '@/lib/subscription/tierRank';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { RADIUS_VISIBILITY_KM } from '@/lib/plans/planVisibilityConfig';

export const DEFAULT_BOOST_RADIUS_KM = RADIUS_VISIBILITY_KM;

/** Creator effective tier from feed join (`profiles.subscription_badge`). */
export function resolveCreatorEffectiveTierFromFeedRow(row: PlanFeedRow): SubscriptionTier {
  const badge = row.creatorProfile?.subscription_badge;
  if (badge === 'PLATINUM' || badge === 'GOLD' || badge === 'SILVER') return badge;
  return 'FREE';
}

/**
 * Inclusive tier-relative audience for visibility='premium'.
 * Mirrors `plan_premium_visibility_allows_viewer` in RLS.
 */
export function planPassesTierRelativePremiumVisibility(
  plan: PlanFeedRow,
  viewerUserId: string | null,
  viewerEffectiveTier: SubscriptionTier,
  viewerLat: number | null,
  viewerLng: number | null
): boolean {
  if (plan.visibility !== 'premium') return true;
  if (viewerUserId && plan.creator_id === viewerUserId) return true;

  const creatorRank = tierRank(resolveCreatorEffectiveTierFromFeedRow(plan));
  const viewerRank = tierRank(viewerEffectiveTier);
  const isBoosted = !!plan.boosted_until && new Date(plan.boosted_until) > new Date();
  const boostRadiusKm = plan.boost_radius_km ?? DEFAULT_BOOST_RADIUS_KM;

  if (creatorRank === 0) return viewerRank >= 1;
  if (creatorRank === 1) return viewerRank <= 1;
  if (creatorRank === 2) {
    if (viewerRank <= 2) return true;
    if (
      isBoosted &&
      viewerRank === 3 &&
      viewerLat != null &&
      viewerLng != null &&
      plan.latitude != null &&
      plan.longitude != null
    ) {
      return distanceKm(viewerLat, viewerLng, plan.latitude, plan.longitude) <= boostRadiusKm;
    }
    return false;
  }
  return true;
}

export function filterTierRelativePremiumVisibilityPlans(
  rows: PlanFeedRow[],
  viewerUserId: string | null,
  viewerEffectiveTier: SubscriptionTier,
  viewerLat: number | null,
  viewerLng: number | null
): PlanFeedRow[] {
  return rows.filter((row) =>
    planPassesTierRelativePremiumVisibility(
      row,
      viewerUserId,
      viewerEffectiveTier,
      viewerLat,
      viewerLng
    )
  );
}

/** Free creators must upgrade; Silver+ can select visibility='premium'. */
export function canCreatorSelectPremiumVisibility(creatorTier: SubscriptionTier): boolean {
  return creatorTier !== 'FREE';
}

export function getFourthVisibilityOptionCopy(creatorTier: SubscriptionTier): {
  label: string;
  description: string;
  tierBadge?: SubscriptionTier;
} {
  switch (creatorTier) {
    case 'FREE':
      return {
        label: 'Silver, Gold & Platinum members',
        description:
          'Only members on a paid plan can discover this — a great way to get noticed by active members.',
        tierBadge: 'PLATINUM',
      };
    case 'SILVER':
      return {
        label: 'Free & Silver members only',
        description: 'Only Free and Silver members can discover this plan.',
      };
    case 'GOLD':
      return {
        label: 'Free, Silver & Gold members',
        description:
          'Free, Silver, and Gold members can discover this plan. If you boost it, nearby Platinum members can too.',
      };
    case 'PLATINUM':
      return {
        label: 'All members',
        description:
          'Everyone can discover this plan. Boosting puts it higher in feeds and extends its reach across cities.',
      };
  }
}
