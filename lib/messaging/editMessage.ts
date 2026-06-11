import {
  canEditMessage,
  MESSAGE_EDIT_WINDOW_MS,
  withinMsSince,
} from '@/lib/messaging/messageEditRules';
import {
  normalizeChatMessageRow,
  runMessageSelect,
  type ChatMessageRow,
} from '@/lib/messaging/chatQueries';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EditMessageResult =
  | { ok: true; row: ChatMessageRow }
  | { ok: false; error: string; code?: 'window_expired' | 'empty' | 'unchanged' };

export async function editMessage(
  client: SupabaseClient,
  message: Pick<ChatMessageRow, 'id' | 'sender_id' | 'created_at' | 'text' | 'body' | 'deleted_at'>,
  viewerId: string,
  nextText: string,
  moderationStatus: 'clean' | 'flagged' = 'clean'
): Promise<EditMessageResult> {
  const body = nextText.trim();
  if (!body) return { ok: false, error: 'Message cannot be empty', code: 'empty' };

  if (!canEditMessage(message, viewerId)) {
    const expired = !withinMsSince(message.created_at, MESSAGE_EDIT_WINDOW_MS);
    return {
      ok: false,
      error: expired
        ? 'This message can no longer be edited'
        : 'This message cannot be edited',
      code: expired ? 'window_expired' : undefined,
    };
  }

  const current = (message.text ?? message.body ?? '').trim();
  if (current === body) {
    return { ok: false, error: 'No changes to save', code: 'unchanged' };
  }

  const { data, error } = await runMessageSelect((cols) =>
    client
      .from('messages')
      .update({
        text: body,
        edited_at: new Date().toISOString(),
        moderation_status: moderationStatus,
      })
      .eq('id', message.id)
      .eq('sender_id', viewerId)
      .is('deleted_at', null)
      .select(cols)
      .single()
  );

  if (error) {
    const msg = error.message ?? 'Could not update message';
    if (msg.includes('message_edit_window_expired')) {
      return { ok: false, error: 'This message can no longer be edited', code: 'window_expired' };
    }
    return { ok: false, error: msg };
  }

  if (!data) return { ok: false, error: 'Could not update message' };

  return {
    ok: true,
    row: normalizeChatMessageRow(data as Record<string, unknown>),
  };
}
