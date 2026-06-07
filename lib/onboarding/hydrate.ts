/**
 * Map Supabase profile row → onboarding draft (resume / prefill).
 */
import { orderPhotoUrls, uniquePhotoUrls } from '@/lib/profile/media/photoOrder';
import { fetchProfileVideo } from '@/lib/profile/media/profileVideo';
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
  const photoPool = uniquePhotoUrls([
    ...(p.photo_urls ?? []),
    p.primary_photo_url,
    p.avatar_url,
  ]);
  if (photoPool.length) {
    const primary = p.primary_photo_url?.trim() || photoPool[0];
    d.remotePhotoUrls = orderPhotoUrls(photoPool, primary ?? null);
    if (primary) d.primaryPhotoRef = { kind: 'remote', url: primary };
  }
  if (p.age_min != null) d.ageMin = p.age_min;
  if (p.age_max != null) d.ageMax = p.age_max;
  if (p.radius_km != null) d.radiusKm = Number(p.radius_km);
  if (p.location_label?.trim()) d.locationLabel = p.location_label.trim();
  if (p.latitude != null && p.longitude != null) {
    d.locationLatitude = p.latitude;
    d.locationLongitude = p.longitude;
  }
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
  if (pref.adult_confirmed === true) d.adultConfirmed = true;
  else if (p.birth_date && ageFromBirthDate(d.birthDate) >= 18) d.adultConfirmed = true;

  return d;
}

/** Load profile intro video into draft (async — call after draftFromProfile). */
export async function enrichDraftWithProfileVideo(
  userId: string,
  draft: OnboardingDraft
): Promise<OnboardingDraft> {
  const patch = await fetchProfileVideoDraftPatch(userId);
  return patch ? { ...draft, ...patch } : draft;
}

/** Video fields only — safe to merge into live draft state without wiping edits. */
export async function fetchProfileVideoDraftPatch(
  userId: string
): Promise<Pick<OnboardingDraft, 'remoteVideoUrl' | 'remoteVideoMediaId' | 'localVideoUri'> | null> {
  const video = await fetchProfileVideo(userId);
  if (!video) return null;
  return {
    remoteVideoUrl: video.url,
    remoteVideoMediaId: video.id,
    localVideoUri: null,
  };
}

/** After a successful save, merge uploaded photos without wiping in-progress local state. */
export function mergeDraftAfterSave(
  current: OnboardingDraft,
  uploadedPhotoUrls: string[]
): OnboardingDraft {
  const mergedUrls = uniquePhotoUrls([...current.remotePhotoUrls, ...uploadedPhotoUrls]);

  let primaryRef = current.primaryPhotoRef;
  if (primaryRef?.kind === 'local') {
    const uploaded = uploadedPhotoUrls[primaryRef.index];
    if (uploaded) primaryRef = { kind: 'remote', url: uploaded };
    else if (mergedUrls[0]) primaryRef = { kind: 'remote', url: mergedUrls[0] };
  }

  const primaryUrl = primaryRef?.kind === 'remote' ? primaryRef.url : mergedUrls[0] ?? null;
  const remotePhotoUrls = orderPhotoUrls(mergedUrls, primaryUrl);
  const primary_photo_url = remotePhotoUrls[0] ?? null;

  return {
    ...current,
    localPhotoUris: [],
    remotePhotoUrls,
    primaryPhotoRef: primary_photo_url
      ? { kind: 'remote', url: primary_photo_url }
      : primaryRef,
  };
}

/** After save when video was uploaded locally. */
export function mergeDraftAfterVideoSave(
  current: OnboardingDraft,
  videoUrl: string | null,
  videoMediaId: string | null
): OnboardingDraft {
  return {
    ...current,
    localVideoUri: null,
    remoteVideoUrl: videoUrl,
    remoteVideoMediaId: videoMediaId,
  };
}
