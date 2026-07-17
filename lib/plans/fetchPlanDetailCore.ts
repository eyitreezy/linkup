import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbPlan, DbPlanOffer } from '@/types/database';

export type PlanDetailCore = {
  plan: DbPlan;
  offers: DbPlanOffer[];
};

/** Fast path: plan row + recent offers — unlocks action buttons before secondary fetches. */
export async function fetchPlanDetailCore(
  client: SupabaseClient,
  planId: string
): Promise<{ data: PlanDetailCore | null; error: string | null }> {
  const [{ data: planRow, error: planError }, { data: offersRaw, error: offersError }] =
    await Promise.all([
      client.from('plans').select('*').eq('id', planId).maybeSingle(),
      client
        .from('plan_offers')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  if (planError) return { data: null, error: planError.message };
  if (offersError) return { data: null, error: offersError.message };
  if (!planRow) return { data: null, error: 'Plan not found' };

  return {
    data: {
      plan: planRow as DbPlan,
      offers: (offersRaw ?? []) as DbPlanOffer[],
    },
    error: null,
  };
}
