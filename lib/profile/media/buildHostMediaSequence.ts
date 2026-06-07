import { resolveOrderedProfilePhotos } from '@/lib/profile/displayMedia';
import type { ProfileVideoRecord } from '@/lib/profile/media/profileVideo';
import type { DbProfile } from '@/types/database';

export type HostMediaItem =
  | { kind: 'photo'; url: string }
  | { kind: 'video'; url: string; durationSeconds?: number | null };

type HostProfile = Pick<DbProfile, 'primary_photo_url' | 'photo_urls' | 'avatar_url'>;

/**
 * Dating-app style sequence: photos first, intro video after the 3rd photo when possible.
 * Photo 1 · Photo 2 · Photo 3 · Video · Photo 4 …
 */
export function buildHostMediaSequence(
  profile: HostProfile | null | undefined,
  video: ProfileVideoRecord | null
): HostMediaItem[] {
  const photos = resolveOrderedProfilePhotos(profile ?? null);
  const items: HostMediaItem[] = photos.map((url) => ({ kind: 'photo', url }));

  if (!video?.url) return items;

  const videoItem: HostMediaItem = {
    kind: 'video',
    url: video.url,
    durationSeconds: null,
  };

  if (items.length >= 3) {
    return [...items.slice(0, 3), videoItem, ...items.slice(3)];
  }

  return [...items, videoItem];
}
