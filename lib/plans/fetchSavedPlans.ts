/**
 * Saved plans (Premium bookmarks) for the Saved tab.
 */
import { supabase } from '@/lib/supabase';
import type { DbPlan, DbProfile } from '@/types/database';

export type SavedPlanListItem = {
  plan: DbPlan;
  creator: Pick<DbProfile, 'display_name' | 'avatar_url' | 'verified_badge'>;
  savedAt: string;
};

export async function fetchSavedPlansList(userId: string): Promise<SavedPlanListItem[]> {
  const { data: rows, error } = await supabase
    .from('plan_engagements')
    .select('plan_id, created_at')
    .eq('user_id', userId)
    .eq('kind', 'save')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const ids = [...new Set((rows ?? []).map((r) => r.plan_id as string))];
  if (ids.length === 0) return [];

  const savedAtByPlan = new Map((rows ?? []).map((r) => [r.plan_id as string, r.created_at as string]));

  const { data: plans, error: pe } = await supabase.from('plans').select('*').in('id', ids);
  if (pe) throw pe;

  const planList = (plans ?? []) as DbPlan[];
  const creatorIds = [...new Set(planList.map((p) => p.creator_id))];

  const { data: profs, error: prE } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, verified_badge')
    .in('user_id', creatorIds);
  if (prE) throw prE;

  const profByUser = new Map(
    (profs ?? []).map((r) => [
      r.user_id as string,
      {
        display_name: r.display_name as string | null,
        avatar_url: r.avatar_url as string | null,
        verified_badge: !!(r as { verified_badge?: boolean }).verified_badge,
      },
    ])
  );

  const out: SavedPlanListItem[] = [];
  for (const plan of planList) {
    const pr = profByUser.get(plan.creator_id);
    out.push({
      plan,
      creator: {
        display_name: pr?.display_name ?? null,
        avatar_url: pr?.avatar_url ?? null,
        verified_badge: pr?.verified_badge ?? false,
      },
      savedAt: savedAtByPlan.get(plan.id) ?? plan.created_at,
    });
  }

  out.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return out;
}
