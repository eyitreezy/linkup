import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchViewerPrivacyPrefs,
  shouldSkipPlanViewRecording,
} from '@/lib/plans/incognitoEngagement';

export async function recordPlanView(
  client: SupabaseClient,
  planId: string,
  userId: string
): Promise<void> {
  const prefs = await fetchViewerPrivacyPrefs(client, userId);
  if (shouldSkipPlanViewRecording(prefs)) return;

  await client.from('plan_engagements').upsert(
    {
      plan_id: planId,
      user_id: userId,
      kind: 'view',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'plan_id,user_id,kind' }
  );
}

export async function setPlanSaved(
  client: SupabaseClient,
  planId: string,
  userId: string,
  saved: boolean
): Promise<{ error: string | null }> {
  if (saved) {
    const { error } = await client.from('plan_engagements').upsert(
      {
        plan_id: planId,
        user_id: userId,
        kind: 'save',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'plan_id,user_id,kind' }
    );
    return { error: error?.message ?? null };
  }
  const { error } = await client
    .from('plan_engagements')
    .delete()
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .eq('kind', 'save');
  return { error: error?.message ?? null };
}

export async function isPlanSaved(
  client: SupabaseClient,
  planId: string,
  userId: string
): Promise<boolean> {
  const { data } = await client
    .from('plan_engagements')
    .select('id')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .eq('kind', 'save')
    .maybeSingle();
  return !!data?.id;
}
