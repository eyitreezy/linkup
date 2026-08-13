import { readLocalAssetAsUint8Array } from '@/lib/nativeImageRead';
import { buildMediaInsertPayload } from '@/lib/media/mediaInsertPayload';
import { PROFILE_MEDIA_VIDEO_KIND } from '@/lib/profile/media/constants';
import {
  PROFILE_VIDEO_MAX_COUNT,
  PROFILE_VIDEO_MAX_FILE_SIZE_BYTES,
  PROFILE_VIDEO_DURATION_ERROR,
  PROFILE_VIDEO_SIZE_ERROR,
  PROFILE_VIDEO_TYPE_ERROR,
  isAllowedProfileVideoMime,
  profileVideoDurationWithinLimit,
} from '@/lib/profile/media/videoLimits';
import { probeProfileVideoDurationSeconds } from '@/lib/profile/media/probeProfileVideoDuration';
import { supabase } from '@/lib/supabase';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

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

function rowToProfileVideo(row: {
  id: string;
  storage_path: string;
  mime_type: string | null;
  metadata: unknown;
}): ProfileVideoRecord | null {
  const meta = row.metadata as { kind?: string } | null;
  const isVideo =
    meta?.kind === PROFILE_MEDIA_VIDEO_KIND || String(row.mime_type ?? '').startsWith('video/');
  if (!isVideo || !row.storage_path) return null;
  return {
    id: row.id,
    url: publicVideoUrl(row.storage_path),
    storagePath: row.storage_path,
    mimeType: row.mime_type,
  };
}

export async function fetchProfileVideos(userId: string): Promise<ProfileVideoRecord[]> {
  const { data, error } = await supabase
    .from('media')
    .select('id, storage_path, mime_type, metadata')
    .eq('parent_table', 'profiles')
    .eq('parent_id', userId)
    .order('created_at', { ascending: true })
    .limit(PROFILE_VIDEO_MAX_COUNT);

  if (error || !data?.length) return [];
  return data
    .map((row) => rowToProfileVideo(row))
    .filter((v): v is ProfileVideoRecord => v !== null);
}

export async function fetchProfileVideo(userId: string): Promise<ProfileVideoRecord | null> {
  const videos = await fetchProfileVideos(userId);
  return videos[0] ?? null;
}

/** Batch intro videos for discover feed creators (newest per user). */
export async function fetchProfileVideosForUsers(
  userIds: string[]
): Promise<Map<string, ProfileVideoRecord>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, ProfileVideoRecord>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from('media')
    .select('id, storage_path, mime_type, metadata, parent_id')
    .eq('parent_table', 'profiles')
    .in('parent_id', unique)
    .order('created_at', { ascending: false });

  if (error || !data?.length) return map;

  for (const row of data) {
    const userId = row.parent_id as string;
    if (map.has(userId)) continue;
    const video = rowToProfileVideo(row);
    if (video) map.set(userId, video);
  }
  return map;
}

async function removeVideoStorage(storagePath: string) {
  if (!storagePath) return;
  await supabase.storage.from('profile-videos').remove([storagePath]);
}

export async function deleteProfileVideo(userId: string, mediaId?: string | null): Promise<void> {
  let query = supabase
    .from('media')
    .select('id, storage_path')
    .eq('parent_table', 'profiles')
    .eq('parent_id', userId);
  if (mediaId) query = query.eq('id', mediaId);

  const { data: rows } = await query;
  for (const row of rows ?? []) {
    await removeVideoStorage(row.storage_path);
    await supabase.from('media').delete().eq('id', row.id);
  }
}

async function localFileSize(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Video file not found.');
    const blob = await res.blob();
    return blob.size;
  }

  const file = new File(uri);
  if (!file.exists) throw new Error('Video file not found.');
  return file.size;
}

export async function uploadProfileVideo(
  userId: string,
  localUri: string,
  existingMediaId?: string | null
): Promise<ProfileVideoRecord> {
  const size = await localFileSize(localUri);
  if (size > PROFILE_VIDEO_MAX_FILE_SIZE_BYTES) {
    throw new Error(PROFILE_VIDEO_SIZE_ERROR);
  }

  const mime = mimeFromUri(localUri);
  if (!isAllowedProfileVideoMime(mime, localUri)) {
    throw new Error(PROFILE_VIDEO_TYPE_ERROR);
  }

  const durationSeconds = await probeProfileVideoDurationSeconds(localUri);
  if (durationSeconds == null || !profileVideoDurationWithinLimit(durationSeconds)) {
    throw new Error(PROFILE_VIDEO_DURATION_ERROR);
  }

  if (existingMediaId) {
    await deleteProfileVideo(userId, existingMediaId);
  }

  const path = `${userId}/${Date.now()}-intro.${extForMime(mime)}`;
  const bytes = await readLocalAssetAsUint8Array(localUri);
  const { error: uploadErr } = await supabase.storage.from('profile-videos').upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (uploadErr) throw uploadErr;

  const publicUrl = publicVideoUrl(path);
  const { data, error } = await supabase
    .from('media')
    .insert(
      buildMediaInsertPayload({
        parent_table: 'profiles',
        parent_id: userId,
        storage_bucket: 'profile-videos',
        storage_path: path,
        mime_type: mime,
        media_url: publicUrl,
        metadata: { kind: PROFILE_MEDIA_VIDEO_KIND },
        created_by: userId,
      })
    )
    .select('id, storage_path, mime_type')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not save profile video.');

  return {
    id: data.id,
    url: publicUrl,
    storagePath: data.storage_path,
    mimeType: data.mime_type,
  };
}
