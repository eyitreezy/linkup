import { supabase } from '@/lib/supabase';

export async function fetchHiddenMessageIdsForConversation(
  userId: string,
  conversationId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('message_user_deletions')
    .select('message_id')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId);
  if (error) return [];
  return (data ?? []).map((r) => r.message_id as string);
}

export type HideMessageForMeResult = { ok: true } | { ok: false; error: string };

/** Removes the message from this user's thread only. */
export async function hideMessageForMe(
  userId: string,
  messageId: string,
  conversationId: string
): Promise<HideMessageForMeResult> {
  const { error } = await supabase.from('message_user_deletions').upsert(
    {
      user_id: userId,
      message_id: messageId,
      conversation_id: conversationId,
    },
    { onConflict: 'user_id,message_id' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function filterMessagesHiddenForUser<T extends { id: string }>(
  rows: T[],
  hiddenIds: ReadonlySet<string>
): T[] {
  if (hiddenIds.size === 0) return rows;
  return rows.filter((m) => !hiddenIds.has(m.id));
}
