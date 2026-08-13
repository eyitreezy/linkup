/** Hard upload limit for profile videos (seconds). */
export const PROFILE_VIDEO_MAX_DURATION_SECONDS = 21;

/** Tiny float slack for encoder metadata (e.g. 21.02s for a 21s export). */
export const PROFILE_VIDEO_DURATION_TOLERANCE_SECONDS = 0.05;

/** Maximum profile video file size in bytes (30MB). */
export const PROFILE_VIDEO_MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

/** Human-readable size label for error messages. */
export const PROFILE_VIDEO_MAX_SIZE_LABEL = '30MB';

/** Maximum profile videos per user. */
export const PROFILE_VIDEO_MAX_COUNT = 3;

/** Minimum profile videos required for onboarding. */
export const PROFILE_VIDEO_MIN_COUNT = 1;

export const PROFILE_VIDEO_DURATION_ERROR = `Video length is greater than ${PROFILE_VIDEO_MAX_DURATION_SECONDS} seconds. Please trim it and try again.`;
export const PROFILE_VIDEO_SIZE_ERROR = 'Video size is greater than 30Mb.';
export const PROFILE_VIDEO_TYPE_ERROR = 'Video type is not MP4, MOV, or WebM.';
export const PROFILE_VIDEO_DURATION_UNKNOWN_ERROR =
  'Could not verify video length. Please try a shorter clip.';

export function formatProfileVideoSlotError(slotIndex: number, error: string): string {
  return `Video ${slotIndex + 1}: ${error}`;
}

const ALLOWED_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']);

function mimeFromUri(uri: string): string | null {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  return null;
}

export function profileVideoDurationWithinLimit(durationSeconds: number | null | undefined): boolean {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) return false;
  return durationSeconds <= PROFILE_VIDEO_MAX_DURATION_SECONDS + PROFILE_VIDEO_DURATION_TOLERANCE_SECONDS;
}

/** Normalize Expo ImagePicker duration (milliseconds on most platforms, seconds on some). */
export function normalizeProfileVideoDurationSeconds(
  duration: number | null | undefined
): number | null {
  if (duration == null || !Number.isFinite(duration) || duration <= 0) return null;
  if (duration >= 1000) return duration / 1000;
  return duration;
}

export function isAllowedProfileVideoMime(
  mimeType: string | null | undefined,
  uri?: string | null
): boolean {
  const normalized = mimeType?.trim().toLowerCase();
  if (normalized && ALLOWED_MIMES.has(normalized)) return true;
  if (uri) {
    const fromUri = mimeFromUri(uri);
    if (fromUri && ALLOWED_MIMES.has(fromUri)) return true;
  }
  return false;
}

export function validateProfileVideoTypeAndSize(file: {
  size?: number;
  mimeType?: string | null;
  uri?: string | null;
}): { valid: boolean; error: string | null } {
  if (!isAllowedProfileVideoMime(file.mimeType, file.uri)) {
    return { valid: false, error: PROFILE_VIDEO_TYPE_ERROR };
  }
  if (file.size != null && file.size > PROFILE_VIDEO_MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: PROFILE_VIDEO_SIZE_ERROR };
  }
  return { valid: true, error: null };
}

export function validateProfileVideoDuration(
  durationSeconds: number | null | undefined
): { valid: boolean; error: string | null } {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) {
    return { valid: false, error: PROFILE_VIDEO_DURATION_UNKNOWN_ERROR };
  }
  if (!profileVideoDurationWithinLimit(durationSeconds)) {
    return { valid: false, error: PROFILE_VIDEO_DURATION_ERROR };
  }
  return { valid: true, error: null };
}

export function validateProfileVideoPick(file: {
  size?: number;
  duration?: number | null;
  mimeType?: string | null;
  uri?: string | null;
}): { valid: boolean; error: string | null } {
  const typeAndSize = validateProfileVideoTypeAndSize(file);
  if (!typeAndSize.valid) return typeAndSize;
  return validateProfileVideoDuration(file.duration);
}

/** @deprecated Prefer validateProfileVideoPick for picker flows. */
export function validateProfileVideoFile(
  file: { size?: number; duration?: number | null; mimeType?: string | null; uri?: string | null }
): { valid: boolean; error: string | null } {
  return validateProfileVideoPick(file);
}
