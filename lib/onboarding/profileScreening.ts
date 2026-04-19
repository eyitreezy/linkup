/**
 * Initial AI-assisted profile screening (PDF “Initial AI check”).
 * Lightweight text heuristics + trust score — **not** KYC face-match (tune thresholds separately).
 * Callers must treat failures as non-blocking (user still enters the app).
 */
import { scoreProfileBio } from '@/lib/ai';
import type { OnboardingDraft } from '@/types/onboarding';

export type InitialProfileScreeningResult = {
  trust_score: number;
  flags: string[];
};

/**
 * Runs automated screening on display name, bio, interests, languages, and prompt answers.
 * Photo content is not vision-analyzed here (add Edge + storage triggers later); only counts are used.
 */
export async function runInitialProfileScreening(draft: OnboardingDraft): Promise<InitialProfileScreeningResult> {
  const chunks: string[] = [
    draft.displayName.trim(),
    draft.bio.trim(),
    draft.interests.join(' '),
    ...draft.languages,
    ...draft.promptAnswers.map((p) => p.answer.trim()).filter(Boolean),
  ];
  const text = chunks.filter(Boolean).join('\n').trim() || ' ';

  const scored = await scoreProfileBio(text);

  const flags = [...scored.flags];
  const photoCount = draft.localPhotoUris.length + draft.remotePhotoUrls.length;
  if (photoCount === 0) flags.push('no_photos_yet');
  if (photoCount === 1) flags.push('single_photo_only');

  let trust = scored.trust_score;
  if (flags.includes('no_photos_yet')) trust = Math.min(trust, 0.5);
  trust = Math.max(0, Math.min(1, trust - (flags.length - scored.flags.length) * 0.03));

  return {
    trust_score: trust,
    flags: [...new Set(flags)],
  };
}
