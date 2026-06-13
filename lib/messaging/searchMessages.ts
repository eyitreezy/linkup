import {
  chatMessageSelectColumns,
  isMissingColumnError,
  markForwardColumnUnsupported,
  markReceiptColumnUnsupported,
  markReplyColumnUnsupported,
  normalizeChatMessageRow,
  type ChatMessageRow,
} from '@/lib/messaging/chatQueries';
import { supabase } from '@/lib/supabase';

function downgradeCols(cols: string): string {
  if (cols.includes('receipt_hidden')) {
    markReceiptColumnUnsupported();
    return cols.replace(', receipt_hidden', '');
  }
  if (cols.includes('forwarded_from_message_id')) {
    markForwardColumnUnsupported();
    return cols.replace(', is_forwarded, forwarded_from_message_id', '');
  }
  if (cols.includes('reply_to_message_id')) {
    markReplyColumnUnsupported();
    return cols.replace(', reply_to_message_id', '');
  }
  return cols;
}

export async function searchMessagesInConversation(
  conversationId: string,
  query: string,
  viewerId: string
): Promise<ChatMessageRow[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  let cols = chatMessageSelectColumns();
  let result = await supabase
    .from('messages')
    .select(cols)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .ilike('text', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  while (isMissingColumnError(result.error)) {
    const next = downgradeCols(cols);
    if (next === cols) break;
    cols = next;
    result = await supabase
      .from('messages')
      .select(cols)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .ilike('text', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20);
  }

  if (result.error || !result.data?.length) return [];

  const rows = result.data.map((row) => normalizeChatMessageRow(row as Record<string, unknown>));
  const ids = rows.map((r) => r.id);
  const { data: deletions } = await supabase
    .from('message_user_deletions')
    .select('message_id')
    .eq('user_id', viewerId)
    .in('message_id', ids);

  const hidden = new Set((deletions ?? []).map((d) => d.message_id as string));
  return rows.filter((r) => !hidden.has(r.id));
}
