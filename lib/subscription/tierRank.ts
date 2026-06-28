import type { SubscriptionTier } from '@/lib/subscription/pricing';

export const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 0,
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3,
};

export function tierRank(tier: SubscriptionTier): number {
  return TIER_RANK[tier] ?? 0;
}
