import type { SupabaseClient } from '@supabase/supabase-js';

export async function closeGroupAndCreateHostEscrow(
  client: SupabaseClient,
  planId: string
): Promise<{ hostEscrowId: string | null; error: string | null }> {
  const { data, error } = await client.rpc('close_group_and_create_host_escrow', {
    p_plan_id: planId,
  });
  if (error) return { hostEscrowId: null, error: error.message };
  return { hostEscrowId: (data as string) ?? null, error: null };
}
