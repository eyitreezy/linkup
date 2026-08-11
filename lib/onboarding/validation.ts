import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { ageFromBirthDate } from '@/lib/onboarding/hydrate';
import { PROFILE_MIN_PHOTOS_ONBOARDING } from '@/lib/profile/media/constants';
import { PROFILE_VIDEO_MIN_COUNT } from '@/lib/profile/media/videoLimits';
import { defaultPrimaryRef, resolvePhotoUrl } from '@/lib/profile/media/photoOrder';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import type { OnboardingDraft } from '@/types/onboarding';

const PROMPT_ANSWER_MAX_LENGTH = 200;

function photoCount(draft: OnboardingDraft): number {
  return draft.localPhotoUris.length + draft.remotePhotoUrls.length;
}

function filledVideoCount(draft: OnboardingDraft): number {
  return draft.videos.filter((v) => v.localUri || v.remoteUrl).length;
}

function hasIntroVideo(draft: OnboardingDraft): boolean {
  return filledVideoCount(draft) >= PROFILE_VIDEO_MIN_COUNT;
}

function hasValidPrimaryPhoto(draft: OnboardingDraft): boolean {
  if (photoCount(draft) === 0) return false;
  const ref = draft.primaryPhotoRef ?? defaultPrimaryRef(draft.remotePhotoUrls, draft.localPhotoUris);
  if (!ref) return false;
  return resolvePhotoUrl(ref, draft.remotePhotoUrls, draft.localPhotoUris) != null;
}

function validatePromptAnswers(draft: OnboardingDraft): string | null {
  const filled = draft.promptAnswers.filter((p) => p.answer.trim().length > 0);
  if (filled.length < 1) {
    return 'Answer at least one prompt before completing onboarding.';
  }
  if (filled.length > 2) {
    return 'You can answer up to two prompts.';
  }
  for (const p of filled) {
    if (p.answer.length > PROMPT_ANSWER_MAX_LENGTH) {
      return `Each prompt answer must be ${PROMPT_ANSWER_MAX_LENGTH} characters or less.`;
    }
  }
  return null;
}

function onboardingMediaValidationMessage(draft: OnboardingDraft): string | null {
  const photos = photoCount(draft);
  const video = hasIntroVideo(draft);
  if (photos < PROFILE_MIN_PHOTOS_ONBOARDING && !video) {
    return `You need at least ${PROFILE_MIN_PHOTOS_ONBOARDING} profile photos and one intro video before completing onboarding.`;
  }
  if (photos < PROFILE_MIN_PHOTOS_ONBOARDING) {
    return `You need at least ${PROFILE_MIN_PHOTOS_ONBOARDING} profile photos before completing onboarding.`;
  }
  if (!video) {
    return 'Add one intro video before completing onboarding.';
  }
  if (!hasValidPrimaryPhoto(draft)) {
    return 'Choose a primary profile photo before completing onboarding.';
  }
  return null;
}

/** Strict validation against the current in-memory draft only — no cached completion flags. */
export function getOnboardingFinishBlocker(draft: OnboardingDraft): string | null {
  if (draft.displayName.trim().length < 1) {
    return 'Add a display name before completing onboarding.';
  }
  if (!draft.adultConfirmed) {
    return 'Confirm you are 18 or older before completing onboarding.';
  }
  if (ageFromBirthDate(draft.birthDate) < 18) {
    return 'You must be 18 or older to use LinkUp.';
  }

  const mediaMsg = onboardingMediaValidationMessage(draft);
  if (mediaMsg) return mediaMsg;

  if (draft.bio.trim().length > 150) {
    return 'Bio must be 150 characters or less.';
  }
  if (draft.interests.length < 1) {
    return 'Add at least one interest before completing onboarding.';
  }
  if (draft.languages.length < 1) {
    return 'Add at least one language before completing onboarding.';
  }
  if (draft.meetingIntent == null) {
    return 'Choose what you’re here for before completing onboarding.';
  }

  const promptErr = validatePromptAnswers(draft);
  if (promptErr) return promptErr;

  if (!hasValidProfileLocation(draft)) {
    return 'Pick your location from search results before completing onboarding.';
  }

  return null;
}

/** Step index (0-based) for the first failing requirement. */
export function getOnboardingFinishBlockerStep(draft: OnboardingDraft): number {
  if (
    draft.displayName.trim().length < 1 ||
    !draft.adultConfirmed ||
    ageFromBirthDate(draft.birthDate) < 18 ||
    onboardingMediaValidationMessage(draft)
  ) {
    return 0;
  }

  if (
    draft.bio.trim().length > 150 ||
    draft.interests.length < 1 ||
    draft.languages.length < 1 ||
    draft.meetingIntent == null ||
    validatePromptAnswers(draft)
  ) {
    return 1;
  }

  if (!hasValidProfileLocation(draft)) {
    return 2;
  }

  return ONBOARDING_TOTAL_STEPS - 1;
}

export function getOnboardingStepBlocker(draft: OnboardingDraft, stepIndex: number): string | null {
  if (stepIndex === 0) {
    if (draft.displayName.trim().length < 1) return 'Add a display name to continue.';
    if (!draft.adultConfirmed) return 'Confirm you are 18+ to continue.';
    if (ageFromBirthDate(draft.birthDate) < 18) return 'You must be 18 or older.';
    return onboardingMediaValidationMessage(draft);
  }

  if (stepIndex === 1) {
    if (draft.bio.trim().length > 150) return 'Bio must be 150 characters or less.';
    if (draft.interests.length < 1) return 'Add at least one interest to continue.';
    if (draft.languages.length < 1) return 'Add at least one language to continue.';
    if (draft.meetingIntent == null) return 'Choose what you’re here for to continue.';
    return validatePromptAnswers(draft);
  }

  if (stepIndex === 2) {
    if (!hasValidProfileLocation(draft)) return 'Pick your location from search results.';
    return null;
  }

  return getOnboardingFinishBlocker(draft);
}

export type OnboardingValidationFocus =
  | 'displayName'
  | 'photos'
  | 'video'
  | 'bio'
  | 'interests'
  | 'languages'
  | 'intent'
  | 'prompts'
  | 'location';

export function getOnboardingValidationFocus(draft: OnboardingDraft): OnboardingValidationFocus | null {
  if (draft.displayName.trim().length < 1) return 'displayName';
  if (!draft.adultConfirmed || ageFromBirthDate(draft.birthDate) < 18) return 'displayName';
  const photos = photoCount(draft);
  if (photos < PROFILE_MIN_PHOTOS_ONBOARDING) return 'photos';
  if (!hasIntroVideo(draft)) return 'video';
  if (!hasValidPrimaryPhoto(draft)) return 'photos';
  if (draft.bio.trim().length > 150) return 'bio';
  if (draft.interests.length < 1) return 'interests';
  if (draft.languages.length < 1) return 'languages';
  if (draft.meetingIntent == null) return 'intent';
  if (validatePromptAnswers(draft)) return 'prompts';
  if (!hasValidProfileLocation(draft)) return 'location';
  return null;
}
