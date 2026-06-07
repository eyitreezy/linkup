import type { DbProfile } from '@/types/database';

/**
 * Rough completion score for trust UI (not used for gating).
 */
export function profileCompletionPercent(profile: DbProfile | null | undefined, verified: boolean): number {
  if (!profile) return 0;
  const weights: boolean[] = [
    !!(profile.display_name?.trim().length),
    !!(profile.bio?.trim().length),
    (profile.photo_urls?.length ?? 0) >= 1 || !!profile.avatar_url || !!profile.primary_photo_url,
    (profile.preferences?.interests?.length ?? 0) >= 1,
    (profile.preferences?.prompt_answers?.filter((p) => p.answer?.trim().length).length ?? 0) >= 1,
    verified,
  ];
  const done = weights.filter(Boolean).length;
  return Math.round((done / weights.length) * 100);
}
