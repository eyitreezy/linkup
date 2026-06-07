import { orderPhotoUrls, uniquePhotoUrls } from '@/lib/profile/media/photoOrder';
import type { DbProfile } from '@/types/database';

type PhotoProfile = Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'>;

/** Hero / avatar — primary photo when set, else first gallery photo. */
export function resolveProfileHeroPhoto(profile: PhotoProfile | null | undefined): string | null {
  if (!profile) return null;
  if (profile.primary_photo_url?.trim()) return profile.primary_photo_url;
  if (profile.photo_urls?.length) return profile.photo_urls[0] ?? null;
  return profile.avatar_url ?? null;
}

/** Gallery order: primary → other photos (for carousels / previews). */
export function resolveOrderedProfilePhotos(profile: PhotoProfile | null | undefined): string[] {
  const pool = uniquePhotoUrls([
    ...(profile?.photo_urls ?? []),
    profile?.primary_photo_url,
    profile?.avatar_url,
  ]);
  if (!pool.length) return [];
  const primary = profile?.primary_photo_url?.trim() || pool[0];
  return orderPhotoUrls(pool, primary);
}
