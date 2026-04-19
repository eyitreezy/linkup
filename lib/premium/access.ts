import type { DbUser } from '@/types/database';

/** Premium unlocks filters, travel mode, interest insights, unlimited boosts (credit not consumed). */
export function isPremiumSubscriber(user: DbUser | null | undefined): boolean {
  if (!user?.premium_until) return false;
  if (new Date(user.premium_until).getTime() <= Date.now()) return false;
  if (user.subscription_status === 'expired') return false;
  return true;
}

export function hasBoostCredit(user: DbUser | null | undefined): boolean {
  return (user?.boost_credits ?? 0) > 0;
}

export function canBoostPlan(user: DbUser | null | undefined): boolean {
  return isPremiumSubscriber(user) || hasBoostCredit(user);
}
