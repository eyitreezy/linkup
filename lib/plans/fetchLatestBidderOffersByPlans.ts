/**
 * Latest offer per plan for the current user as bidder (any status).
 */
import { supabase } from '@/lib/supabase';
import type { DbPlanOffer } from '@/types/database';

export async function fetchLatestBidderOffersByPlanIds(
  userId: string,
  planIds: string[]
): Promise<Record<string, DbPlanOffer>> {
  if (planIds.length === 0) return {};
  const { data, error } = await supabase
    .from('plan_offers')
    .select('*')
    .eq('bidder_id', userId)
    .in('plan_id', planIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const map: Record<string, DbPlanOffer> = {};
  for (const row of data ?? []) {
    const o = row as DbPlanOffer;
    if (map[o.plan_id] == null) map[o.plan_id] = o;
  }
  return map;
}
