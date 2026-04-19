/**
 * Persist onboarding steps to Supabase (profiles + preferences JSONB + avatar storage).
 */
import { readLocalAssetAsUint8Array } from '@/lib/nativeImageRead';
import { runInitialProfileScreening } from '@/lib/onboarding/profileScreening';
import { supabase } from '@/lib/supabase';
import type { OnboardingDraft } from '@/types/onboarding';
import { preferencesFromDraft } from '@/types/onboarding';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import type { ProfilePreferences } from '@/types/database';

export function stripOnboardingResumeStep(prefs: ProfilePreferences): ProfilePreferences {
  const { onboarding_step: _s, ...rest } = prefs as ProfilePreferences & { onboarding_step?: number };
  return rest;
}

/** Persist current wizard step so users resume after Google/email sign-in. */
export async function persistOnboardingResumeStep(args: {
  userId: string;
  stepIndex: number;
  existingPreferences: ProfilePreferences | null;
}): Promise<{ error: Error | null }> {
  const { userId, stepIndex, existingPreferences } = args;
  const clamped = Math.max(0, Math.min(stepIndex, ONBOARDING_TOTAL_STEPS - 1));
  const merged: ProfilePreferences = {
    ...(existingPreferences ?? {}),
    onboarding_step: clamped,
  };
  const { error } = await supabase.from('profiles').update({ preferences: merged }).eq('user_id', userId);
  return { error: error ? new Error(error.message) : null };
}
export async function uploadNewLocalPhotos(userId: string, uris: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    const path = `${userId}/${Date.now()}-${i}.jpg`;
    const bytes = await readLocalAssetAsUint8Array(uri);
    const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

function birthIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function saveOnboardingStep(args: {
  userId: string;
  draft: OnboardingDraft;
  existingPreferences: ProfilePreferences | null;
  /** After a successful "Continue", persist the next wizard index (matches client `setStep(s + 1)`). */
  nextResumeStepIndex?: number;
}): Promise<{ error: Error | null; uploadedPhotoUrls: string[] }> {
  const { userId, draft, existingPreferences, nextResumeStepIndex } = args;
  const mergedPrefs: ProfilePreferences = {
    ...(existingPreferences ?? {}),
    ...preferencesFromDraft(draft),
  };
  if (typeof nextResumeStepIndex === 'number' && Number.isFinite(nextResumeStepIndex)) {
    mergedPrefs.onboarding_step = Math.max(
      0,
      Math.min(Math.floor(nextResumeStepIndex), ONBOARDING_TOTAL_STEPS - 1)
    );
  }

  /** PDF “Initial AI check”: non-blocking — failure must not abort save. */
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
    if (__DEV__) console.warn('[onboarding] initial profile screening failed (non-blocking):', e);
  }

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
      preferences: mergedPrefs,
      ...(typeof screeningTrust === 'number' ? { ai_trust_score: screeningTrust } : {}),
    })
    .eq('user_id', userId);

  return { error: error ? new Error(error.message) : null, uploadedPhotoUrls };
}

export async function finalizeOnboarding(args: {
  userId: string;
  draft: OnboardingDraft;
  existingPreferences: ProfilePreferences | null;
  mode: 'publish' | 'draft' | 'skip';
}): Promise<{ error: Error | null; uploadedPhotoUrls: string[] }> {
  const { userId, draft, existingPreferences, mode } = args;

  if (mode === 'skip') {
    const cleaned = stripOnboardingResumeStep({ ...(existingPreferences ?? {}) });
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_status: 'skipped', preferences: cleaned })
      .eq('user_id', userId);
    return { error: error ? new Error(error.message) : null, uploadedPhotoUrls: [] };
  }

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

  const mergedPrefs: ProfilePreferences = {
    ...(existingPreferences ?? {}),
    ...preferencesFromDraft(draft),
    profile_draft: mode === 'draft',
  };

  const avatar_url = photo_urls[0] ?? null;

  /** Broader than bio-only `scoreProfileBio`; still non-blocking if it throws. */
  let finalizeTrust: number | undefined;
  try {
    const s = await runInitialProfileScreening(draft);
    finalizeTrust = s.trust_score;
    mergedPrefs.ai_flags = s.flags;
    mergedPrefs.initial_profile_screening = {
      trust_score: s.trust_score,
      flags: s.flags,
      checked_at: new Date().toISOString(),
      source: 'onboarding_finalize',
    };
  } catch (e) {
    if (__DEV__) console.warn('[onboarding] finalize screening failed (non-blocking):', e);
  }

  const preferencesOut =
    mode === 'publish' ? stripOnboardingResumeStep(mergedPrefs) : mergedPrefs;

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
      onboarding_status: mode === 'publish' ? 'complete' : 'pending',
      ...(typeof finalizeTrust === 'number' ? { ai_trust_score: finalizeTrust } : {}),
      preferences: preferencesOut,
    })
    .eq('user_id', userId);

  return { error: error ? new Error(error.message) : null, uploadedPhotoUrls };
}
