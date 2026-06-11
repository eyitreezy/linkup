import { supabase } from '@/lib/supabase';

export type ConversationPinState = {
  pinnedMessageId: string | null;
  pinnedAt: string | null;
  pinnedBy: string | null;
};

const PIN_COLUMNS = 'pinned_message_id, pinned_at, pinned_by' as const;

let pinColumnsSupported: boolean | null = null;

function pinSelectColumns(): string {
  return pinColumnsSupported === false ? 'id' : PIN_COLUMNS;
}

export async function fetchConversationPin(
  conversationId: string
): Promise<ConversationPinState> {
  let cols = pinSelectColumns();
  let { data, error } = await supabase
    .from('conversations')
    .select(cols)
    .eq('id', conversationId)
    .maybeSingle();

  if (error?.code === '42703' && pinColumnsSupported !== false) {
    pinColumnsSupported = false;
    return fetchConversationPin(conversationId);
  }
  if (error || !data) {
    return { pinnedMessageId: null, pinnedAt: null, pinnedBy: null };
  }

  const row = data as unknown as Record<string, unknown>;
  return {
    pinnedMessageId: (row.pinned_message_id as string | null | undefined) ?? null,
    pinnedAt: (row.pinned_at as string | null | undefined) ?? null,
    pinnedBy: (row.pinned_by as string | null | undefined) ?? null,
  };
}

export async function pinConversationMessage(
  conversationId: string,
  messageId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('conversations')
    .update({
      pinned_message_id: messageId,
      pinned_at: new Date().toISOString(),
      pinned_by: userId,
    })
    .eq('id', conversationId);

  if (error?.code === '42703') {
    return { ok: false, error: 'Pin is not available until the latest database migration is applied.' };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unpinConversationMessage(
  conversationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('conversations')
    .update({
      pinned_message_id: null,
      pinned_at: null,
      pinned_by: null,
    })
    .eq('id', conversationId);

  if (error?.code === '42703') {
    return { ok: false, error: 'Pin is not available until the latest database migration is applied.' };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
