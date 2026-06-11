import { supabase } from '@/lib/supabase';

const HIDDEN_CAP = 200;

export async function fetchHiddenPlanIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('hidden_plans')
    .select('plan_id')
    .eq('user_id', userId)
    .order('hidden_at', { ascending: false })
    .limit(HIDDEN_CAP);
  if (error) return [];
  return (data ?? []).map((r) => r.plan_id as string);
}

/** Fire-and-forget — caller already updated in-memory feed. */
export function persistHiddenPlan(userId: string, planId: string): void {
  void supabase
    .from('hidden_plans')
    .upsert({ user_id: userId, plan_id: planId }, { onConflict: 'user_id,plan_id' });
}

export function removeHiddenPlan(userId: string, planId: string): void {
  void supabase.from('hidden_plans').delete().eq('user_id', userId).eq('plan_id', planId);
}
