import type { DbUser } from '@/types/database';
import type { SubscriptionTier } from '@/lib/subscription/pricing';

/** UI-only effective tier mirror — gates must use permission-service. */
export function resolveClientEffectiveTier(user: DbUser | null | undefined, now = Date.now()): SubscriptionTier {
  if (!user) return 'FREE';

  const paidTier = user.subscription_tier ?? 'FREE';
  const paidActive =
    paidTier !== 'FREE' &&
    !!user.subscription_expires_at &&
    new Date(user.subscription_expires_at).getTime() > now;

  if (paidActive && (paidTier === 'PLATINUM' || paidTier === 'GOLD')) {
    return paidTier;
  }

  if (hasActiveGoldTrial(user)) {
    return 'GOLD';
  }

  if (paidActive && paidTier === 'SILVER') {
    return 'SILVER';
  }

  if (paidTier === 'FREE' && hasActiveSilverTrial(user)) {
    return 'SILVER';
  }

  // Legacy Paystack premium maps to SILVER-equivalent benefits at resolution time only
  if (user.premium_until && new Date(user.premium_until).getTime() > now) {
    return 'SILVER';
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

export function hasLegacyPremium(user: DbUser | null | undefined): boolean {
  if (!user?.premium_until) return false;
  return new Date(user.premium_until).getTime() > Date.now();
}
