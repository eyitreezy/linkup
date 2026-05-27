/**
 * Full profile save from onboarding-shaped draft (Edit profile) — preserves premium/settings preference keys.
 */
import { ageFromBirthDate } from '@/lib/onboarding/hydrate';
import { uploadNewLocalPhotos } from '@/lib/onboarding/persist';
import { runInitialProfileScreening } from '@/lib/onboarding/profileScreening';
import { hasValidProfileLocation, profileLocationFromDraft } from '@/lib/profile/profileLocation';
import { supabase } from '@/lib/supabase';
import type { ProfilePreferences } from '@/types/database';
import { preferencesFromDraft, type OnboardingDraft } from '@/types/onboarding';

function birthIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function saveEditProfile(args: {
  userId: string;
  draft: OnboardingDraft;
  existingPreferences: ProfilePreferences | null;
}): Promise<{ error: Error | null; uploadedPhotoUrls: string[] }> {
  const { userId, draft, existingPreferences } = args;
  const age = ageFromBirthDate(draft.birthDate);
  if (age < 18) return { error: new Error('You must be 18 or older.'), uploadedPhotoUrls: [] };
  if (!draft.displayName.trim()) return { error: new Error('Add a display name.'), uploadedPhotoUrls: [] };
  const photoCount = draft.localPhotoUris.length + draft.remotePhotoUrls.length;
  if (photoCount < 1) return { error: new Error('Add at least one photo.'), uploadedPhotoUrls: [] };

  const filled = draft.promptAnswers.filter((p) => p.answer.trim().length > 0);
  if (draft.bio.trim().length > 150) {
    return { error: new Error('Bio must be 150 characters or less.'), uploadedPhotoUrls: [] };
  }
  if (draft.interests.length < 1 || draft.languages.length < 1) {
    return { error: new Error('Pick at least one interest and one language.'), uploadedPhotoUrls: [] };
  }
  if (draft.meetingIntent == null) {
    return { error: new Error('Choose what you are here for.'), uploadedPhotoUrls: [] };
  }
  if (filled.length < 1 || filled.length > 2) {
    return { error: new Error('Add one or two prompt answers.'), uploadedPhotoUrls: [] };
  }
  if (!hasValidProfileLocation(draft)) {
    return {
      error: new Error('Add your location — pick from search or use current location.'),
      uploadedPhotoUrls: [],
    };
  }

  const mergedPrefs: ProfilePreferences = {
    ...(existingPreferences ?? {}),
    ...preferencesFromDraft(draft),
  };

  let uploadedPhotoUrls: string[] = [];
  let photo_urls = [...draft.remotePhotoUrls];
  if (draft.localPhotoUris.length > 0) {
    try {
      uploadedPhotoUrls = await uploadNewLocalPhotos(userId, draft.localPhotoUris);
      photo_urls = [...photo_urls, ...uploadedPhotoUrls];
    } catch (e) {
      return {
        error: e instanceof Error ? e : new Error(String(e)),
        uploadedPhotoUrls: [],
      };
    }
  }

  const avatar_url = photo_urls[0] ?? null;

  let screeningTrust: number | undefined;
  try {
    const s = await runInitialProfileScreening(draft);
    screeningTrust = s.trust_score;
    mergedPrefs.ai_flags = s.flags;
    mergedPrefs.initial_profile_screening = {
      trust_score: s.trust_score,
      flags: s.flags,
      checked_at: new Date().toISOString(),
      source: 'onboarding_save',
    };
  } catch (e) {
    if (__DEV__) console.warn('[edit-profile] screening failed (non-blocking):', e);
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: draft.displayName.trim(),
      bio: draft.bio.trim() || null,
      birth_date: birthIso(draft.birthDate),
      gender: draft.selfGender,
      photo_urls,
      avatar_url,
      age_min: draft.ageMin,
      age_max: draft.ageMax,
      radius_km: draft.radiusKm,
      is_profile_public: draft.profilePublic,
      ...profileLocationFromDraft(draft),
      preferences: mergedPrefs,
      ...(typeof screeningTrust === 'number' ? { ai_trust_score: screeningTrust } : {}),
    })
    .eq('user_id', userId);

  return { error: error ? new Error(error.message) : null, uploadedPhotoUrls };
}
