import type { SubscriptionTier } from '@/lib/subscription/pricing';

/** Tier multiplier on profile `radius_km` when `discover.wider_radius` is allowed. */
export const RADIUS_MULTIPLIER: Record<SubscriptionTier, number> = {
  FREE: 1,
  SILVER: 1.5,
  GOLD: 2,
  PLATINUM: 3,
};

export function radiusMultiplierForTier(tier: SubscriptionTier): number {
  return RADIUS_MULTIPLIER[tier] ?? 1;
}

export function effectiveDiscoveryRadiusKm(
  baseRadiusKm: number,
  tier: SubscriptionTier,
  hasWiderRadius: boolean
): number {
  if (!hasWiderRadius) return baseRadiusKm;
  return Math.round(baseRadiusKm * radiusMultiplierForTier(tier));
}
