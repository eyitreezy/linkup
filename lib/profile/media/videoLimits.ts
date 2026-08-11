/** Maximum profile video duration in seconds. */
export const PROFILE_VIDEO_MAX_DURATION_SECONDS = 20;

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

/** Human-readable size label for error messages. */
export const PROFILE_VIDEO_MAX_SIZE_LABEL = '30MB';

/** Maximum profile videos per user. */
export const PROFILE_VIDEO_MAX_COUNT = 3;

/** Minimum profile videos required for onboarding. */
export const PROFILE_VIDEO_MIN_COUNT = 1;

export function validateProfileVideoFile(
  file: { size?: number; duration?: number | null }
): { valid: boolean; error: string | null } {
  if (file.size != null && file.size > PROFILE_VIDEO_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Video must be under ${PROFILE_VIDEO_MAX_SIZE_LABEL}. Please trim or compress it and try again.`,
    };
  }
  if (file.duration != null && file.duration > PROFILE_VIDEO_MAX_DURATION_SECONDS) {
    return {
      valid: false,
      error: `Video must be ${PROFILE_VIDEO_MAX_DURATION_SECONDS} seconds or less. Please trim it and try again.`,
    };
  }
  return { valid: true, error: null };
}
