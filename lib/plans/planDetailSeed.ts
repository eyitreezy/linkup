import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';

const seedByPlanId = new Map<string, DbPlan>();
const inflightPrefetch = new Map<string, Promise<void>>();

export function planFromFeedRow(row: PlanFeedRow): DbPlan {
  const { creatorProfile: _cp, creatorVerification: _cv, meetType: _mt, ...plan } = row;
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

/** Warm cache for upcoming cards so full row is often ready before navigation. */
export function prefetchPlanDetail(planId: string): void {
  if (!planId || !isSupabaseConfigured || inflightPrefetch.has(planId)) return;
  const run = (async () => {
    try {
      const { data } = await supabase.from('plans').select('*').eq('id', planId).single();
      if (data) seedByPlanId.set(planId, data as DbPlan);
    } finally {
      inflightPrefetch.delete(planId);
    }
  })();
  inflightPrefetch.set(planId, run);
}
