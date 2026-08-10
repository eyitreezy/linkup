/** Map technical save errors to onboarding-friendly copy. */
export function userFacingOnboardingSaveError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('media_type') || lower.includes('violates not-null constraint')) {
    return 'We could not save your intro video. Please try again or choose a different clip.';
  }
  if (lower.includes('video is too large') || lower.includes('under 100mb')) {
    return 'That video is too large. Please trim or compress it (under 100MB and 60 seconds) and try again.';
  }
  if (lower.includes('video must be') && lower.includes('seconds')) {
    return 'That video is too long. Please trim it to 60 seconds or less and try again.';
  }
  if (lower.includes('unsupported video format')) {
    return 'Unsupported video format. Use MP4, MOV, or WebM.';
  }
  return message;
}
