import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import type { DbUser } from '@/types/database';

/** Effective subscription tier for UI badges (not for feature gates — use permission-service). */
export function effectiveSubscriptionTier(user: DbUser | null | undefined) {
  return resolveClientEffectiveTier(user);
}

export function hasBoostCredit(user: DbUser | null | undefined): boolean {
  return (user?.boost_credits ?? 0) > 0;
}
