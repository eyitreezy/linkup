import type { DbPlan, DbPlanOffer } from '@/types/database';

/** Action buttons need plan + offers array (may be empty). Seed cache satisfies this on first paint. */
export function isPlanDetailActionReady(
  plan: DbPlan | null | undefined,
  offers: DbPlanOffer[] | undefined,
  offersLoaded: boolean
): boolean {
  return offersLoaded && Boolean(plan) && Array.isArray(offers);
}
