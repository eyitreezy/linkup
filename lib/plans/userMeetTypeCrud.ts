import type { SupabaseClient } from '@supabase/supabase-js';
import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { invalidateMeetTypesCache } from '@/lib/plans/meetTypes';
import type { DbMeetType } from '@/types/database';

/** Catalog / seeded meet types have `created_by` NULL. */
export function isUserMeetType(type: DbMeetType, userId: string): boolean {
  return !!type.created_by && type.created_by === userId;
}

export async function countPlansUsingMeetType(
  client: SupabaseClient,
  meetTypeId: string
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await client
    .from('plans')
    .select('id', { count: 'exact', head: true })
    .eq('meet_type_id', meetTypeId);
  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

export async function updateUserMeetType(
  client: SupabaseClient,
  userId: string,
  meetTypeId: string,
  name: string
): Promise<{ row: DbMeetType | null; error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { row: null, error: 'Enter a name for your meet type.' };

  const icon = inferMeetTypeIcon(trimmed) as string;

  const { data, error } = await client
    .from('meet_types')
    .update({ name: trimmed, icon })
    .eq('id', meetTypeId)
    .eq('created_by', userId)
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  invalidateMeetTypesCache();
  return { row: data as DbMeetType, error: null };
}

export type DeleteUserMeetTypeResult = {
  error: string | null;
  blockedByPlans?: boolean;
  planCount?: number;
};

export async function deleteUserMeetType(
  client: SupabaseClient,
  userId: string,
  meetTypeId: string
): Promise<DeleteUserMeetTypeResult> {
  const { count, error: countErr } = await countPlansUsingMeetType(client, meetTypeId);
  if (countErr) return { error: countErr };
  if (count > 0) {
    return { error: null, blockedByPlans: true, planCount: count };
  }

  const { error } = await client.from('meet_types').delete().eq('id', meetTypeId).eq('created_by', userId);
  if (error) return { error: error.message };
  invalidateMeetTypesCache();
  return { error: null };
}
