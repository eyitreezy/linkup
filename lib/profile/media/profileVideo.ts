import { readLocalAssetAsUint8Array } from '@/lib/nativeImageRead';
import { PROFILE_MEDIA_VIDEO_KIND, PROFILE_VIDEO_MAX_BYTES, PROFILE_VIDEO_MIME_TYPES } from '@/lib/profile/media/constants';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

export type ProfileVideoRecord = {
  id: string;
  url: string;
  storagePath: string;
  mimeType: string | null;
};

function extForMime(mime: string): string {
  if (mime === 'video/quicktime') return 'mov';
  if (mime === 'video/webm') return 'webm';
  return 'mp4';
}

function mimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

function publicVideoUrl(storagePath: string): string {
  const { data } = supabase.storage.from('profile-videos').getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function fetchProfileVideo(userId: string): Promise<ProfileVideoRecord | null> {
  const { data, error } = await supabase
    .from('media')
    .select('id, storage_path, mime_type, metadata')
    .eq('parent_table', 'profiles')
    .eq('parent_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error || !data?.length) return null;

  const row = data.find((r) => {
    const meta = r.metadata as { kind?: string } | null;
    return meta?.kind === PROFILE_MEDIA_VIDEO_KIND || String(r.mime_type ?? '').startsWith('video/');
  });

  if (!row?.storage_path) return null;

  return {
    id: row.id,
    url: publicVideoUrl(row.storage_path),
    storagePath: row.storage_path,
    mimeType: row.mime_type,
  };
}

async function removeVideoStorage(storagePath: string) {
  if (!storagePath) return;
  await supabase.storage.from('profile-videos').remove([storagePath]);
}

export async function deleteProfileVideo(userId: string, mediaId?: string | null): Promise<void> {
  let query = supabase.from('media').select('id, storage_path').eq('parent_table', 'profiles').eq('parent_id', userId);
  if (mediaId) query = query.eq('id', mediaId);

  const { data: rows } = await query;
  for (const row of rows ?? []) {
    await removeVideoStorage(row.storage_path);
    await supabase.from('media').delete().eq('id', row.id);
  }
}

export async function uploadProfileVideo(userId: string, localUri: string): Promise<ProfileVideoRecord> {
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) throw new Error('Video file not found.');
  if (typeof info.size === 'number' && info.size > PROFILE_VIDEO_MAX_BYTES) {
    throw new Error('Video is too large. Please upload a shorter clip (under 30 seconds).');
  }

  const mime = mimeFromUri(localUri);
  if (!PROFILE_VIDEO_MIME_TYPES.includes(mime as (typeof PROFILE_VIDEO_MIME_TYPES)[number])) {
    throw new Error('Unsupported video format. Use MP4, MOV, or WebM.');
  }

  await deleteProfileVideo(userId);

  const path = `${userId}/${Date.now()}-intro.${extForMime(mime)}`;
  const bytes = await readLocalAssetAsUint8Array(localUri);
  const { error: uploadErr } = await supabase.storage.from('profile-videos').upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from('media')
    .insert({
      parent_table: 'profiles',
      parent_id: userId,
      storage_bucket: 'profile-videos',
      storage_path: path,
      mime_type: mime,
      metadata: { kind: PROFILE_MEDIA_VIDEO_KIND },
      created_by: userId,
    })
    .select('id, storage_path, mime_type')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not save profile video.');

  return {
    id: data.id,
    url: publicVideoUrl(data.storage_path),
    storagePath: data.storage_path,
    mimeType: data.mime_type,
  };
}
