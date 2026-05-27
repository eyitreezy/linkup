/** True when a plan is actively boosted in discover (server `boosted_until` in the future). */
export function isPlanBoostActive(boostedUntil: string | null | undefined): boolean {
  if (!boostedUntil) return false;
  return new Date(boostedUntil).getTime() > Date.now();
}
