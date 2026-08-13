import {
  PROFILE_VIDEO_DURATION_ERROR,
  PROFILE_VIDEO_SIZE_ERROR,
  PROFILE_VIDEO_TYPE_ERROR,
} from '@/lib/profile/media/videoLimits';

/** Map technical save errors to onboarding-friendly copy. */
export function userFacingOnboardingSaveError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('media_type') || lower.includes('violates not-null constraint')) {
    return 'We could not save your intro video. Please try again or choose a different clip.';
  }
  if (message.includes(PROFILE_VIDEO_SIZE_ERROR) || lower.includes('greater than 30mb')) {
    return PROFILE_VIDEO_SIZE_ERROR;
  }
  if (
    message.includes(PROFILE_VIDEO_DURATION_ERROR) ||
    lower.includes('greater than 21s') ||
    lower.includes('greater than 20s') ||
    lower.includes('greater than 21 seconds') ||
    lower.includes('greater than 20 seconds')
  ) {
    return PROFILE_VIDEO_DURATION_ERROR;
  }
  if (message.includes(PROFILE_VIDEO_TYPE_ERROR) || lower.includes('unsupported video')) {
    return PROFILE_VIDEO_TYPE_ERROR;
  }
  return message;
}
