import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { seedPlanDetailOffers } from '@/lib/plans/planDetailOffersSeed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan, DbPlanOffer } from '@/types/database';

const seedByPlanId = new Map<string, DbPlan>();
const inflightPrefetch = new Map<string, Promise<void>>();

export function planFromFeedRow(row: PlanFeedRow): DbPlan {
  const {
    creatorProfile: _cp,
    creatorVerification: _cv,
    creatorIntroVideo: _civ,
    meetType: _mt,
    ...plan
  } = row;
  return plan as DbPlan;
}

/** Call right before navigating from Discover so Plan overview can paint without waiting on fetch. */
export function seedPlanDetailFromFeed(row: PlanFeedRow): void {
  seedByPlanId.set(row.id, planFromFeedRow(row));
}

export function peekPlanDetailSeed(planId: string): DbPlan | null {
  return seedByPlanId.get(planId) ?? null;
}

export function setPlanDetailSeed(planId: string, plan: DbPlan): void {
  seedByPlanId.set(planId, plan);
}

/** Seed cache + start background prefetch before navigating to meetup details. */
export function warmPlanDetailNavigation(
  planId: string,
  seed?: { plan?: DbPlan | null; offers?: DbPlanOffer[] | null }
): void {
  if (!planId) return;
  if (seed?.plan) seedByPlanId.set(planId, seed.plan);
  if (seed?.offers) seedPlanDetailOffers(planId, seed.offers);
  prefetchPlanDetail(planId);
}

/** Warm cache for upcoming cards so full row is often ready before navigation. */
export function prefetchPlanDetail(planId: string): void {
  if (!planId || !isSupabaseConfigured || inflightPrefetch.has(planId)) return;
  const run = (async () => {
    try {
      const [{ data: plan }, { data: offers }] = await Promise.all([
        supabase.from('plans').select('*').eq('id', planId).single(),
        supabase
          .from('plan_offers')
          .select('*')
          .eq('plan_id', planId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (plan) seedByPlanId.set(planId, plan as DbPlan);
      if (offers) seedPlanDetailOffers(planId, offers as DbPlanOffer[]);
    } finally {
      inflightPrefetch.delete(planId);
    }
  })();
  inflightPrefetch.set(planId, run);
}
