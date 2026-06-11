import { supabase } from '@/lib/supabase';

export const CHAT_PAGE_SIZE = 40;

/** Base columns — always available. */
export const CHAT_MESSAGE_COLUMNS_BASE =
  'id, text, body, media_id, sender_id, created_at, edited_at, deleted_at' as const;

/** Includes reply_to when migration `20260619000000_chat_realtime_reads_reply` is applied. */
export const CHAT_MESSAGE_COLUMNS_WITH_REPLY =
  `${CHAT_MESSAGE_COLUMNS_BASE}, reply_to_message_id` as const;

/** Includes forward metadata when migration `20260620000001_chat_forward_pin` is applied. */
export const CHAT_MESSAGE_COLUMNS_FULL =
  `${CHAT_MESSAGE_COLUMNS_WITH_REPLY}, is_forwarded, forwarded_from_message_id` as const;

/** @deprecated Use `chatMessageSelectColumns()` — auto-falls back when columns missing. */
export const CHAT_MESSAGE_COLUMNS = CHAT_MESSAGE_COLUMNS_FULL;

let replyColumnSupported: boolean | null = null;
let forwardColumnSupported: boolean | null = null;

export function chatMessageSelectColumns(): string {
  if (replyColumnSupported === false) return CHAT_MESSAGE_COLUMNS_BASE;
  if (forwardColumnSupported === false) return CHAT_MESSAGE_COLUMNS_WITH_REPLY;
  return CHAT_MESSAGE_COLUMNS_FULL;
}

export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703';
}

export function markReplyColumnUnsupported(): void {
  replyColumnSupported = false;
}

export function markForwardColumnUnsupported(): void {
  forwardColumnSupported = false;
}

function downgradeMessageColumns(cols: string): string {
  if (cols === CHAT_MESSAGE_COLUMNS_FULL) {
    markForwardColumnUnsupported();
    return CHAT_MESSAGE_COLUMNS_WITH_REPLY;
  }
  if (cols === CHAT_MESSAGE_COLUMNS_WITH_REPLY) {
    markReplyColumnUnsupported();
    return CHAT_MESSAGE_COLUMNS_BASE;
  }
  return cols;
}

export function normalizeChatMessageRow(row: Record<string, unknown>): ChatMessageRow {
  return {
    id: row.id as string,
    text: (row.text as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    media_id: (row.media_id as string | null) ?? null,
    sender_id: row.sender_id as string,
    created_at: row.created_at as string,
    edited_at: (row.edited_at as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    reply_to_message_id: (row.reply_to_message_id as string | null | undefined) ?? null,
    is_forwarded: (row.is_forwarded as boolean | undefined) ?? false,
    forwarded_from_message_id:
      (row.forwarded_from_message_id as string | null | undefined) ?? null,
  };
}

/** Run a message select; retries without reply_to when the column is not migrated yet. */
export async function runMessageSelect<T>(
  run: (cols: string) => PromiseLike<{
    data: T | null;
    error: { code?: string; message?: string } | null;
  }>
): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  let cols = chatMessageSelectColumns();
  let result = await run(cols);
  while (isMissingColumnError(result.error)) {
    const next = downgradeMessageColumns(cols);
    if (next === cols) break;
    cols = next;
    result = await run(cols);
  }
  return result;
}

export type ChatMessageRow = {
  id: string;
  /** Canonical message text (spec). */
  text: string | null;
  /** Legacy column; kept in sync with `text` in DB. */
  body: string | null;
  media_id: string | null;
  sender_id: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id: string | null;
  is_forwarded: boolean;
  forwarded_from_message_id: string | null;
};

export type ReplyQuotePreview = {
  messageId: string;
  senderId: string;
  senderLabel: string;
  preview: string;
  isDeleted: boolean;
};

/** Resolve the quoted parent for a reply message from the loaded thread. */
export function resolveReplyQuote(
  m: ChatMessageRow,
  byId: Map<string, ChatMessageRow>,
  peerName: string,
  myUserId: string,
  hasMediaFor: (messageId: string) => boolean
): ReplyQuotePreview | null {
  if (!m.reply_to_message_id) return null;
  const parent = byId.get(m.reply_to_message_id);
  if (!parent) {
    return {
      messageId: m.reply_to_message_id,
      senderId: '',
      senderLabel: 'Message',
      preview: 'Original message',
      isDeleted: false,
    };
  }
  return buildReplyQuoteFromTarget(parent, peerName, myUserId, hasMediaFor(parent.id));
}

/** Clipboard-friendly text for copy action. */
export function messageCopyText(
  m: ChatMessageRow,
  opts?: { hasMedia?: boolean; mediaKind?: 'image' | 'video' | null }
): string {
  const text = messageDisplayText(m)?.trim() ?? '';
  if (text) return text;
  if (opts?.hasMedia) return opts.mediaKind === 'video' ? 'Video' : 'Photo';
  return '';
}

export function buildReplyQuoteFromTarget(
  target: ChatMessageRow,
  peerName: string,
  myUserId: string,
  hasMedia?: boolean
): ReplyQuotePreview {
  const mine = target.sender_id === myUserId;
  const text = messageDisplayText(target)?.trim();
  let preview = text;
  if (!preview && hasMedia) preview = 'Attachment';
  if (!preview) preview = 'Message';
  if (target.deleted_at) {
    return {
      messageId: target.id,
      senderId: target.sender_id,
      senderLabel: mine ? 'You' : peerName,
      preview: 'Message deleted',
      isDeleted: true,
    };
  }
  return {
    messageId: target.id,
    senderId: target.sender_id,
    senderLabel: mine ? 'You' : peerName,
    preview: preview.slice(0, 180),
    isDeleted: false,
  };
}

/** Display string for a message row (prefers `text`, falls back to `body`). */
export function messageDisplayText(
  m: Partial<Pick<ChatMessageRow, 'text' | 'body' | 'deleted_at'>>
): string | null {
  if (m.deleted_at) return null;
  return m.text ?? m.body ?? null;
}

export type ChatMediaRow = {
  parent_id: string;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
};

export async function fetchMessagesOlderThan(
  conversationId: string,
  beforeCreatedAt: string | undefined,
  limit = CHAT_PAGE_SIZE
): Promise<{ messages: ChatMessageRow[]; mediaByMessageId: Record<string, ChatMediaRow> }> {
  const runFetch = async (cols: string) => {
    let q = supabase
      .from('messages')
      .select(cols)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (beforeCreatedAt) q = q.lt('created_at', beforeCreatedAt);
    return q;
  };

  let cols = chatMessageSelectColumns();
  let { data, error } = await runFetch(cols);
  while (isMissingColumnError(error)) {
    const next = downgradeMessageColumns(cols);
    if (next === cols) break;
    cols = next;
    ({ data, error } = await runFetch(cols));
  }
  if (error) throw error;
  const batch = (data ?? []).map((row) => normalizeChatMessageRow(row as Record<string, unknown>));
  const chronological = [...batch].reverse();
  const ids = chronological.map((m) => m.id);
  const mediaByMessageId: Record<string, ChatMediaRow> = {};

  const fkIds = [...new Set(chronological.map((m) => m.media_id).filter(Boolean))] as string[];
  if (fkIds.length > 0) {
    const { data: byFk, error: fe } = await supabase
      .from('media')
      .select('id, parent_id, mime_type, storage_bucket, storage_path')
      .in('id', fkIds);
    if (fe) throw fe;
    const byId = new Map((byFk ?? []).map((r) => [r.id as string, r]));
    for (const m of chronological) {
      if (!m.media_id) continue;
      const row = byId.get(m.media_id);
      if (row) {
        mediaByMessageId[m.id] = {
          parent_id: m.id,
          mime_type: row.mime_type as string | null,
          storage_bucket: row.storage_bucket as string,
          storage_path: row.storage_path as string,
        };
      }
    }
  }

  const missing = ids.filter((id) => !mediaByMessageId[id]);
  if (missing.length > 0) {
    const { data: med, error: me } = await supabase
      .from('media')
      .select('parent_id, mime_type, storage_bucket, storage_path')
      .eq('parent_table', 'messages')
      .in('parent_id', missing);
    if (me) throw me;
    for (const row of med ?? []) {
      const r = row as ChatMediaRow;
      if (r.parent_id) mediaByMessageId[r.parent_id] = r;
    }
  }
  return { messages: chronological, mediaByMessageId };
}

export function parseLegacyImageBody(body: string | null): string | null {
  if (!body) return null;
  const m = /^\[image\]\s+(.+)$/i.exec(body.trim());
  return m ? m[1].trim() : null;
}

export function mimeToMediaKind(mime: string | null | undefined): 'image' | 'video' | null {
  if (!mime) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return 'image';
}
