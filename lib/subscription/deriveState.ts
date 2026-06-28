import {
  hasActiveGoldTrial,
  hasActiveSilverTrial,
  hasLegacyPremium,
  resolveClientEffectiveTier,
  trialDaysRemaining,
} from '@/lib/subscription/effectiveTier';
import type { BillingCycle, SubscriptionTier } from '@/lib/subscription/pricing';
import type { DbUser } from '@/types/database';

export type SubscriptionState = {
  tier: SubscriptionTier;
  effectiveTier: SubscriptionTier;
  billingCycle: BillingCycle | null;
  expiresAt: string | null;
  legacyPremiumUntil: string | null;
  isTrialActive: boolean;
  trialType: 'silver' | 'gold' | null;
  trialDaysRemaining: number | null;
  isPaidActive: boolean;
  isLegacyPremiumActive: boolean;
};

export function deriveSubscriptionState(user: DbUser | null | undefined): SubscriptionState {
  const now = Date.now();
  const tier = (user?.subscription_tier as SubscriptionTier | undefined) ?? 'FREE';
  const effectiveTier = resolveClientEffectiveTier(user, now);
  const subExpiryMs = user?.subscription_expires_at
    ? new Date(user.subscription_expires_at).getTime()
    : null;
  const isPaidActive = tier !== 'FREE' && subExpiryMs !== null && subExpiryMs > now;
  const isSilverTrialActive = hasActiveSilverTrial(user);
  const isGoldTrialActive = hasActiveGoldTrial(user);
  const isLegacyPremiumActive = hasLegacyPremium(user) && !isPaidActive;

  let trialType: 'silver' | 'gold' | null = null;
  let trialDaysRemainingValue: number | null = null;

  if (isGoldTrialActive && effectiveTier === 'GOLD') {
    trialType = 'gold';
    trialDaysRemainingValue = trialDaysRemaining(user?.gold_trial_expires_at);
  } else if (isSilverTrialActive && effectiveTier === 'SILVER') {
    trialType = 'silver';
    trialDaysRemainingValue = trialDaysRemaining(user?.silver_trial_expires_at);
  }

  return {
    tier,
    effectiveTier,
    billingCycle: (user?.billing_cycle as BillingCycle | null | undefined) ?? null,
    expiresAt: user?.subscription_expires_at ?? null,
    legacyPremiumUntil: user?.premium_until ?? null,
    isTrialActive: isSilverTrialActive || isGoldTrialActive,
    trialType,
    trialDaysRemaining: trialDaysRemainingValue,
    isPaidActive,
    isLegacyPremiumActive,
  };
}
