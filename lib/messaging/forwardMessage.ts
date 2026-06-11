import {
  messageDisplayText,
  mimeToMediaKind,
  normalizeChatMessageRow,
  runMessageSelect,
  type ChatMediaRow,
  type ChatMessageRow,
} from '@/lib/messaging/chatQueries';
import { supabase } from '@/lib/supabase';

export type ForwardMessageInput = {
  source: ChatMessageRow;
  sourceMedia: ChatMediaRow | null;
  targetConversationId: string;
  senderId: string;
};

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return 'bin';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

/** Forward a message into another 1:1 conversation (text + optional media copy). */
export async function forwardMessage(
  input: ForwardMessageInput
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { source, sourceMedia, targetConversationId, senderId } = input;
  if (source.deleted_at) return { ok: false, error: 'Cannot forward a deleted message' };

  const text = messageDisplayText(source)?.trim() ?? null;
  const insertPayload: Record<string, unknown> = {
    conversation_id: targetConversationId,
    sender_id: senderId,
    text,
    moderation_status: 'clean',
    is_forwarded: true,
    forwarded_from_message_id: source.id,
  };

  const { data: inserted, error: insErr } = await runMessageSelect((cols) =>
    supabase
      .from('messages')
      .insert(insertPayload)
      .select(cols)
      .single()
  );

  if (insErr || !inserted) {
    if (insErr?.code === '42703') {
      delete insertPayload.is_forwarded;
      delete insertPayload.forwarded_from_message_id;
      const retry = await runMessageSelect((cols) =>
        supabase
          .from('messages')
          .insert(insertPayload)
          .select(cols)
          .single()
      );
      if (retry.error || !retry.data) {
        return { ok: false, error: retry.error?.message ?? 'Could not forward message' };
      }
      const row = normalizeChatMessageRow(retry.data as Record<string, unknown>);
      if (!sourceMedia) return { ok: true, messageId: row.id };
      const mediaResult = await copyMediaToMessage(sourceMedia, row.id, senderId);
      if (!mediaResult.ok) return mediaResult;
      return { ok: true, messageId: row.id };
    }
    return { ok: false, error: insErr?.message ?? 'Could not forward message' };
  }

  const row = normalizeChatMessageRow(inserted as Record<string, unknown>);
  if (!sourceMedia) return { ok: true, messageId: row.id };

  const mediaResult = await copyMediaToMessage(sourceMedia, row.id, senderId);
  if (!mediaResult.ok) {
    await supabase.from('messages').delete().eq('id', row.id);
    return mediaResult;
  }
  return { ok: true, messageId: row.id };
}

async function copyMediaToMessage(
  sourceMedia: ChatMediaRow,
  messageId: string,
  senderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const bucket = sourceMedia.storage_bucket;
  const fromPath = sourceMedia.storage_path;
  const ext = extFromMime(sourceMedia.mime_type);
  const toPath = `${senderId}/${messageId}-fwd-${Date.now()}.${ext}`;

  const { error: copyErr } = await supabase.storage.from(bucket).copy(fromPath, toPath);
  if (copyErr) {
    return { ok: false, error: copyErr.message ?? 'Could not copy attachment' };
  }

  const { data: medRow, error: medErr } = await supabase
    .from('media')
    .insert({
      parent_table: 'messages',
      parent_id: messageId,
      storage_bucket: bucket,
      storage_path: toPath,
      mime_type: sourceMedia.mime_type,
      created_by: senderId,
    })
    .select('id')
    .single();

  if (medErr || !medRow) {
    await supabase.storage.from(bucket).remove([toPath]);
    return { ok: false, error: medErr?.message ?? 'Could not save forwarded attachment' };
  }

  const { error: updErr } = await supabase
    .from('messages')
    .update({ media_id: medRow.id })
    .eq('id', messageId);

  if (updErr) {
    await supabase.from('media').delete().eq('id', medRow.id);
    await supabase.storage.from(bucket).remove([toPath]);
    return { ok: false, error: updErr.message };
  }

  const { data: msgRow } = await supabase
    .from('messages')
    .select('text, body')
    .eq('id', messageId)
    .maybeSingle();
  const hasCaption = !!(msgRow?.text?.trim() || msgRow?.body?.trim());
  if (!hasCaption) {
    const kind = mimeToMediaKind(sourceMedia.mime_type);
    const fallback = kind === 'video' ? 'Forwarded video' : 'Forwarded photo';
    await supabase.from('messages').update({ text: fallback }).eq('id', messageId);
  }

  return { ok: true };
}
