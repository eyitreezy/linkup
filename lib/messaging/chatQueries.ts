import { supabase } from '@/lib/supabase';

export const CHAT_PAGE_SIZE = 40;

/** Columns returned for chat thread + sends (keep in sync with selects). */
export const CHAT_MESSAGE_COLUMNS =
  'id, text, body, media_id, sender_id, created_at, edited_at, deleted_at' as const;

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
};

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
  let q = supabase
    .from('messages')
    .select(CHAT_MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (beforeCreatedAt) q = q.lt('created_at', beforeCreatedAt);
  const { data, error } = await q;
  if (error) throw error;
  const batch = (data ?? []) as ChatMessageRow[];
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
