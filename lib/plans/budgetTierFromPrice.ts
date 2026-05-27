import type { BudgetTier } from '@/types/database';

/** Coarse tiers for card badges — align product thresholds as needed. */
export function budgetTierFromNgn(ngn: number): BudgetTier {
  if (ngn < 25_000) return 'low';
  if (ngn < 150_000) return 'mid';
  return 'high';
}
