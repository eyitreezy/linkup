/** Map technical save errors to onboarding-friendly copy. */
export function userFacingOnboardingSaveError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('media_type') || lower.includes('violates not-null constraint')) {
    return 'We could not save your intro video. Please try again or choose a different clip.';
  }
  if (lower.includes('video is too large')) {
    return 'That video is too large. Please upload a shorter clip (under 30 seconds).';
  }
  if (lower.includes('unsupported video format')) {
    return 'Unsupported video format. Use MP4, MOV, or WebM.';
  }
  return message;
}
