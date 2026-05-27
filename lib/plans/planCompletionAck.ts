import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Record that this user confirms the completed meetup (second ack unlocks off-platform contact share).
 */
export async function insertPlanCompletionAck(
  client: SupabaseClient,
  planId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await client.from('plan_completion_acks').upsert(
    { plan_id: planId, user_id: userId },
    { onConflict: 'plan_id,user_id' }
  );
  return { error: error?.message ?? null };
}
