import type { SubscriptionTier } from '@/lib/subscription/pricing';

export const GROUP_PLAN_CAPS = {
  GOLD: { max_free_guests: 5, max_premium_guests: -1 },
  PLATINUM: { max_free_guests: 10, max_premium_guests: -1 },
} as const;

/** Max active group chat members (host + guests) for a host tier. */
export function maxGroupChatMembers(hostTier: SubscriptionTier): number {
  if (hostTier === 'PLATINUM') return 1 + GROUP_PLAN_CAPS.PLATINUM.max_free_guests;
  if (hostTier === 'GOLD') return 1 + GROUP_PLAN_CAPS.GOLD.max_free_guests;
  return 0;
}
