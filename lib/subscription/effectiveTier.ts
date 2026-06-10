import type { DbUser } from '@/types/database';
import type { SubscriptionTier } from '@/lib/subscription/pricing';

/** UI-only effective tier mirror — gates must use permission-service. */
export function resolveClientEffectiveTier(user: DbUser | null | undefined, now = Date.now()): SubscriptionTier {
  if (!user) return 'FREE';

  const paid = user.subscription_tier ?? 'FREE';
  if (
    paid !== 'FREE' &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at).getTime() > now
  ) {
    return paid;
  }

  if (
    user.silver_trial_expires_at &&
    new Date(user.silver_trial_expires_at).getTime() > now &&
    paid === 'FREE'
  ) {
    return 'SILVER';
  }

  if (
    user.gold_trial_expires_at &&
    new Date(user.gold_trial_expires_at).getTime() > now &&
    user.has_been_silver_subscriber
  ) {
    return 'GOLD';
  }

  return 'FREE';
}

export function trialDaysRemaining(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function hasActiveSilverTrial(user: DbUser | null | undefined): boolean {
  if (!user?.silver_trial_expires_at) return false;
  if (user.subscription_tier !== 'FREE') return false;
  return new Date(user.silver_trial_expires_at).getTime() > Date.now();
}

export function hasActiveGoldTrial(user: DbUser | null | undefined): boolean {
  if (!user?.gold_trial_expires_at) return false;
  return new Date(user.gold_trial_expires_at).getTime() > Date.now();
}
