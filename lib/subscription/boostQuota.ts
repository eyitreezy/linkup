import type { SubscriptionTier } from '@/lib/subscription/pricing';

export const MONTHLY_24H_BOOSTS: Record<SubscriptionTier, number> = {
  FREE: 0,
  SILVER: 4,
  GOLD: 8,
  PLATINUM: -1,
};

export const MONTHLY_SPOTLIGHTS: Record<SubscriptionTier, number> = {
  FREE: 0,
  SILVER: 3,
  GOLD: 10,
  PLATINUM: -1,
};

/**
 * PUBLISH SPOTLIGHT: sets boosted_until at publish without calling record_boost_usage.
 * This is a free initial promotion window for eligible subscribers, separate from
 * the monthly post-publish boost quota tracked in boost_quota table.
 * Permission used: spotlight.profile (SILVER+).
 * Duration: 4h standard plan, 6h mood plan.
 */

export function getMonthResetLabel(): string {
  const next = new Date();
  next.setMonth(next.getMonth() + 1, 1);
  return next.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export type BoostQuotaMeta = {
  boosts_24hr_monthly?: number;
  boosts_24hr_used?: number;
  boosts_72hr_monthly?: number;
  boosts_72hr_used?: number;
  spotlights_monthly?: number;
  spotlights_used?: number;
};

/** Map permission-service metadata (`quota_used` / `quota_limit`) to boost label fields. */
export function boost24MetaFromPermission(metadata?: Record<string, unknown>): BoostQuotaMeta {
  return {
    boosts_24hr_monthly: (metadata?.quota_limit ?? metadata?.boosts_24hr_monthly) as number | undefined,
    boosts_24hr_used: (metadata?.quota_used ?? metadata?.boosts_24hr_used ?? 0) as number | undefined,
  };
}

export function boost72MetaFromPermission(metadata?: Record<string, unknown>): BoostQuotaMeta {
  return {
    boosts_72hr_monthly: (metadata?.quota_limit ?? metadata?.boosts_72hr_monthly) as number | undefined,
    boosts_72hr_used: (metadata?.quota_used ?? metadata?.boosts_72hr_used ?? 0) as number | undefined,
  };
}

export function boost24Label(meta: BoostQuotaMeta | undefined, allowed: boolean): string {
  if (!allowed) return 'Boost plan';
  const monthly = meta?.boosts_24hr_monthly;
  const used = meta?.boosts_24hr_used ?? 0;
  if (monthly === -1) return 'Boost plan (24h)';
  if (monthly != null && used >= monthly) return `No boosts left · resets ${getMonthResetLabel()}`;
  if (monthly != null) return `Boost plan (24h) · ${monthly - used} left`;
  return 'Boost plan (24h)';
}

export function boost72Label(meta: BoostQuotaMeta | undefined, allowed: boolean): string {
  if (!allowed) return 'Boost 72h';
  const monthly = meta?.boosts_72hr_monthly;
  const used = meta?.boosts_72hr_used ?? 0;
  if (monthly === -1) return 'Boost plan (72h)';
  if (monthly != null && used >= monthly) return `No 72h boosts left · resets ${getMonthResetLabel()}`;
  if (monthly != null && monthly > 0) return `Boost 72h · ${monthly - used} left`;
  return 'Boost plan (72h)';
}

export function isBoost24Exhausted(meta: BoostQuotaMeta | undefined): boolean {
  const monthly = meta?.boosts_24hr_monthly;
  if (monthly == null || monthly === -1) return false;
  return (meta?.boosts_24hr_used ?? 0) >= monthly;
}

export function isBoost72Exhausted(meta: BoostQuotaMeta | undefined): boolean {
  const monthly = meta?.boosts_72hr_monthly;
  if (monthly == null || monthly === -1) return false;
  return (meta?.boosts_72hr_used ?? 0) >= monthly;
}
