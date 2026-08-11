import { uploadNewLocalPhotos } from '@/lib/onboarding/persist';
import { buildProfilePhotoFields, uniquePhotoUrls } from '@/lib/profile/media/photoOrder';
import { deleteProfileVideo, fetchProfileVideos, uploadProfileVideo } from '@/lib/profile/media/profileVideo';
import { PROFILE_VIDEO_MAX_COUNT } from '@/lib/profile/media/videoLimits';
import type { PrimaryPhotoRef } from '@/lib/profile/media/types';
import type { OnboardingDraft } from '@/types/onboarding';

export type PersistedProfileMedia = {
  photo_urls: string[];
  primary_photo_url: string | null;
  avatar_url: string | null;
  videoUrl: string | null;
  videoMediaId: string | null;
  videoUrls: string[];
  videoMediaIds: string[];
};

/**
 * Upload photos + profile videos, return profile column values.
 * Keeps photo_urls + primary_photo_url + avatar_url in sync.
 */
export async function persistProfileMediaFromDraft(args: {
  userId: string;
  draft: OnboardingDraft;
  removeVideo?: boolean;
  existingVideoMediaIds?: string[];
}): Promise<{ media: PersistedProfileMedia; uploadedPhotoUrls: string[] }> {
  const { userId, draft, removeVideo } = args;

  let uploadedPhotoUrls: string[] = [];
  let remoteUrls = uniquePhotoUrls(draft.remotePhotoUrls);
  if (draft.primaryPhotoRef?.kind === 'remote') {
    remoteUrls = uniquePhotoUrls([draft.primaryPhotoRef.url, ...remoteUrls]);
  }

  if (draft.localPhotoUris.length > 0) {
    uploadedPhotoUrls = await uploadNewLocalPhotos(userId, draft.localPhotoUris);
    remoteUrls = [...remoteUrls, ...uploadedPhotoUrls];
  }

  let primaryRef: PrimaryPhotoRef | null = draft.primaryPhotoRef;
  if (primaryRef?.kind === 'local') {
    const localUrl = uploadedPhotoUrls[primaryRef.index] ?? null;
    if (localUrl) primaryRef = { kind: 'remote', url: localUrl };
    else primaryRef = remoteUrls[0] ? { kind: 'remote', url: remoteUrls[0] } : null;
  } else if (!primaryRef && remoteUrls[0]) {
    primaryRef = { kind: 'remote', url: remoteUrls[0] };
  }

  const photoFields = buildProfilePhotoFields({ remoteUrls, primaryRef });

  let baselineIds = args.existingVideoMediaIds;
  if (baselineIds == null) {
    const existing = await fetchProfileVideos(userId);
    baselineIds = existing.map((v) => v.id);
  }

  if (removeVideo) {
    await deleteProfileVideo(userId);
    baselineIds = [];
  }

  const savedVideos: Array<{ url: string; id: string }> = [];

  for (const slot of draft.videos.slice(0, PROFILE_VIDEO_MAX_COUNT)) {
    if (slot.localUri) {
      const saved = await uploadProfileVideo(userId, slot.localUri, slot.mediaId ?? null);
      savedVideos.push({ url: saved.url, id: saved.id });
    } else if (slot.remoteUrl && slot.mediaId) {
      savedVideos.push({ url: slot.remoteUrl, id: slot.mediaId });
    }
  }

  const keptIds = new Set(savedVideos.map((v) => v.id));
  for (const existingId of baselineIds) {
    if (!keptIds.has(existingId)) {
      await deleteProfileVideo(userId, existingId);
    }
  }

  const videoUrl = savedVideos[0]?.url ?? null;
  const videoMediaId = savedVideos[0]?.id ?? null;
  const videoUrls = savedVideos.map((v) => v.url);
  const videoMediaIds = savedVideos.map((v) => v.id);

  return {
    uploadedPhotoUrls,
    media: {
      ...photoFields,
      videoUrl,
      videoMediaId,
      videoUrls,
      videoMediaIds,
    },
  };
}
