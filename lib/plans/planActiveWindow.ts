import type { SubscriptionTier } from '@/lib/subscription/pricing';

/** How long a standard (non-mood) negotiating plan stays live in Discover. */
export const PLAN_ACTIVE_WINDOW_DAYS: Record<SubscriptionTier, number> = {
  FREE: 7,
  SILVER: 14,
  GOLD: 14,
  PLATINUM: 30,
};

export function getPlanActiveWindowDays(tier: SubscriptionTier): number {
  return PLAN_ACTIVE_WINDOW_DAYS[tier] ?? 7;
}

export function planActiveWindowExpiresAt(createdAt: string, tier: SubscriptionTier): Date {
  const days = getPlanActiveWindowDays(tier);
  const d = new Date(createdAt);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysUntilIso(iso: string, now: Date = new Date()): number {
  const ms = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function isPlanActiveWindowExpiringSoon(iso: string, thresholdDays = 3): boolean {
  const days = daysUntilIso(iso);
  return days <= thresholdDays;
}
