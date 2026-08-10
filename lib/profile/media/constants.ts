import { PROFILE_VIDEO_MAX_FILE_SIZE_BYTES } from '@/lib/profile/media/videoLimits';

/** Profile intro video — mp4 / mov / webm, up to 60 seconds / 100MB. */
export const PROFILE_VIDEO_MAX_BYTES = PROFILE_VIDEO_MAX_FILE_SIZE_BYTES;

export const PROFILE_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const PROFILE_MIN_PHOTOS_ONBOARDING = 3;

export const PROFILE_MEDIA_VIDEO_KIND = 'profile_intro';
