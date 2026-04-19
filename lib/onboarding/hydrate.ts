/**
 * Map Supabase profile row → onboarding draft (resume / prefill).
 */
import type { DbProfile } from '@/types/database';
import { defaultOnboardingDraft, type OnboardingDraft, type PromptAnswer } from '@/types/onboarding';

export function ageFromBirthDate(b: Date): number {
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

export function draftFromProfile(p: DbProfile | null): OnboardingDraft {
  const d = defaultOnboardingDraft();
  if (!p) return d;

  if (p.display_name) d.displayName = p.display_name;
  if (p.bio) d.bio = p.bio;
  if (p.birth_date) {
    const [y, m, day] = p.birth_date.split('-').map(Number);
    if (y && m && day) d.birthDate = new Date(y, m - 1, day);
  }
  if (p.photo_urls?.length) d.remotePhotoUrls = [...p.photo_urls];
  if (p.age_min != null) d.ageMin = p.age_min;
  if (p.age_max != null) d.ageMax = p.age_max;
  if (p.radius_km != null) d.radiusKm = Number(p.radius_km);
  d.profilePublic = p.is_profile_public;
  if (p.gender) d.selfGender = p.gender;

  const pref = p.preferences ?? {};
  if (Array.isArray(pref.languages)) d.languages = pref.languages as string[];
  if (Array.isArray(pref.interests)) d.interests = pref.interests as string[];
  if (
    pref.meeting_intent === 'friendship' ||
    pref.meeting_intent === 'dating' ||
    pref.meeting_intent === 'activity' ||
    pref.meeting_intent === 'networking'
  ) {
    d.meetingIntent = pref.meeting_intent;
  }
  if (pref.show_me === 'everyone' || pref.show_me === 'women' || pref.show_me === 'men') {
    d.showMe = pref.show_me;
  }
  if (typeof pref.self_gender === 'string') d.selfGender = pref.self_gender;

  const raw = pref.prompt_answers;
  if (Array.isArray(raw)) {
    d.promptAnswers = raw.map((x: { prompt_id?: string; prompt?: string; answer?: string }) => ({
      promptId: String(x.prompt_id ?? ''),
      prompt: String(x.prompt ?? ''),
      answer: String(x.answer ?? ''),
    })) as PromptAnswer[];
  }

  if (pref.safety_tips_acknowledged === true) d.safetyTipsAcknowledged = true;

  return d;
}
