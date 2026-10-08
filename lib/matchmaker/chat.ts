import { supabase } from '@/lib/supabase';

/** Opens the LinkUp chat thread for a MatchMaker connection (creates conversation if needed). */
export async function openMatchMakerChat(
  connectionId: string,
  viewerId: string,
  partnerId: string
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data: existing, error: findErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('matchmaker_connection_id', connectionId)
    .maybeSingle();

  if (findErr) return { conversationId: null, error: findErr.message };
  if (existing?.id) return { conversationId: existing.id, error: null };

  const ordered =
    viewerId < partnerId
      ? { user_a: viewerId, user_b: partnerId }
      : { user_a: partnerId, user_b: viewerId };

  const { data: created, error: insertErr } = await supabase
    .from('conversations')
    .insert({ ...ordered, matchmaker_connection_id: connectionId, is_group_chat: false })
    .select('id')
    .single();

  if (insertErr) return { conversationId: null, error: insertErr.message };
  return { conversationId: created.id, error: null };
}
