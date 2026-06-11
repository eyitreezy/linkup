import {
  canDeleteMessageForEveryone,
  MESSAGE_DELETE_FOR_EVERYONE_MS,
  withinMsSince,
} from '@/lib/messaging/messageEditRules';
import {
  normalizeChatMessageRow,
  runMessageSelect,
  type ChatMessageRow,
} from '@/lib/messaging/chatQueries';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DeleteForEveryoneResult =
  | { ok: true; row: ChatMessageRow }
  | { ok: false; error: string; code?: 'window_expired' | 'not_sender' };

export async function deleteMessageForEveryone(
  client: SupabaseClient,
  message: Pick<ChatMessageRow, 'id' | 'sender_id' | 'created_at' | 'deleted_at'>,
  viewerId: string
): Promise<DeleteForEveryoneResult> {
  if (!canDeleteMessageForEveryone(message, viewerId)) {
    const expired = !withinMsSince(message.created_at, MESSAGE_DELETE_FOR_EVERYONE_MS);
    if (message.sender_id !== viewerId) {
      return { ok: false, error: 'You can only delete your own messages for everyone', code: 'not_sender' };
    }
    return {
      ok: false,
      error: expired
        ? 'This message can no longer be deleted for everyone'
        : 'This message cannot be deleted for everyone',
      code: expired ? 'window_expired' : undefined,
    };
  }

  const { data, error } = await runMessageSelect((cols) =>
    client
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        text: null,
        body: null,
        media_id: null,
      })
      .eq('id', message.id)
      .eq('sender_id', viewerId)
      .is('deleted_at', null)
      .select(cols)
      .single()
  );

  if (error) {
    const msg = error.message ?? 'Could not delete message';
    if (msg.includes('message_delete_everyone_window_expired')) {
      return {
        ok: false,
        error: 'This message can no longer be deleted for everyone',
        code: 'window_expired',
      };
    }
    return { ok: false, error: msg };
  }

  if (!data) return { ok: false, error: 'Could not delete message' };

  return {
    ok: true,
    row: normalizeChatMessageRow(data as Record<string, unknown>),
  };
}
