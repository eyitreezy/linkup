/**
 * Upload media to Supabase Storage and insert polymorphic `media` row.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function uploadChatImage(
  supabase: SupabaseClient,
  userId: string,
  fileUri: string,
  conversationId: string
): Promise<{ path: string; id: string }> {
  const name = `${userId}/${Date.now()}.jpg`;
  const blob = await (await fetch(fileUri)).blob();
  const { error: upErr } = await supabase.storage.from('chat-media').upload(name, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: row, error } = await supabase
    .from('media')
    .insert({
      parent_table: 'messages',
      parent_id: conversationId,
      storage_bucket: 'chat-media',
      storage_path: name,
      mime_type: 'image/jpeg',
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { path: name, id: row.id };
}
