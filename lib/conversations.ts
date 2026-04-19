/**
 * Direct message threads — canonical ordered pair (user_a < user_b).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export function orderPair(uid1: string, uid2: string): { user_a: string; user_b: string } {
  return uid1 < uid2 ? { user_a: uid1, user_b: uid2 } : { user_a: uid2, user_b: uid1 };
}

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  uid1: string,
  uid2: string
): Promise<string> {
  const { user_a, user_b } = orderPair(uid1, uid2);
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_a', user_a)
    .eq('user_b', user_b)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_a, user_b })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
