/** Whether a creator profile spotlight window is currently active. */
export function isCreatorSpotlightActive(
  spotlightUntil: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!spotlightUntil) return false;
  return new Date(spotlightUntil).getTime() > now.getTime();
}
