import type { SubscriptionTier } from '@/lib/subscription/pricing';

/** Max distance filter slider ceiling by subscription tier. */
export const SLIDER_MAX_KM: Record<SubscriptionTier, number> = {
  FREE: 50,
  SILVER: 50,
  GOLD: 100,
  PLATINUM: 150,
};

export function sliderMaxKmForTier(tier: SubscriptionTier): number {
  return SLIDER_MAX_KM[tier] ?? 50;
}

/** FREE/SILVER upsell toward Gold; Gold upsell toward Platinum. */
export function nextTierForSliderUpsell(tier: SubscriptionTier): SubscriptionTier {
  if (tier === 'GOLD') return 'PLATINUM';
  return 'GOLD';
}

/** Clamp stored max distance to the current tier ceiling (e.g. after downgrade). */
export function clampMaxDistanceKm(km: number, tier: SubscriptionTier): number {
  const max = sliderMaxKmForTier(tier);
  return Math.min(Math.max(km, 1), max);
}
