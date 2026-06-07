import { uploadNewLocalPhotos } from '@/lib/onboarding/persist';
import { buildProfilePhotoFields, uniquePhotoUrls } from '@/lib/profile/media/photoOrder';
import { deleteProfileVideo, uploadProfileVideo } from '@/lib/profile/media/profileVideo';
import type { PrimaryPhotoRef } from '@/lib/profile/media/types';
import type { OnboardingDraft } from '@/types/onboarding';

export type PersistedProfileMedia = {
  photo_urls: string[];
  primary_photo_url: string | null;
  avatar_url: string | null;
  videoUrl: string | null;
  videoMediaId: string | null;
};

/**
 * Upload photos + optional video, return profile column values.
 * Keeps photo_urls + primary_photo_url + avatar_url in sync.
 */
export async function persistProfileMediaFromDraft(args: {
  userId: string;
  draft: OnboardingDraft;
  removeVideo?: boolean;
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

  let videoUrl: string | null = draft.remoteVideoUrl;
  let videoMediaId: string | null = draft.remoteVideoMediaId;

  const shouldRemoveVideo =
    removeVideo || (!draft.localVideoUri && !draft.remoteVideoUrl && !!draft.remoteVideoMediaId);

  if (shouldRemoveVideo) {
    await deleteProfileVideo(userId, draft.remoteVideoMediaId);
    videoUrl = null;
    videoMediaId = null;
  } else if (draft.localVideoUri) {
    const saved = await uploadProfileVideo(userId, draft.localVideoUri);
    videoUrl = saved.url;
    videoMediaId = saved.id;
  }

  return {
    uploadedPhotoUrls,
    media: {
      ...photoFields,
      videoUrl,
      videoMediaId,
    },
  };
}
