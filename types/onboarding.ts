/**
 * Client-side onboarding draft (maps to profiles + preferences JSONB).
 */
import type { ProfilePreferences } from '@/types/database';

export type MeetingIntent = 'friendship' | 'dating' | 'activity' | 'networking';

export type ShowMe = 'everyone' | 'women' | 'men';

export type PromptAnswer = {
  promptId: string;
  prompt: string;
  answer: string;
};

export type OnboardingDraft = {
  displayName: string;
  birthDate: Date;
  /** Local file URIs before upload */
  localPhotoUris: string[];
  /** Already uploaded public URLs (from DB or after upload) */
  remotePhotoUrls: string[];
  bio: string;
  interests: string[];
  languages: string[];
  meetingIntent: MeetingIntent | null;
  promptAnswers: PromptAnswer[];
  /** Self-identity (optional) */
  selfGender: string | null;
  showMe: ShowMe;
  ageMin: number;
  ageMax: number;
  radiusKm: number;
  profilePublic: boolean;
  safetyTipsAcknowledged: boolean;
  /** Optional step 4 */
  skipContactsImport: boolean;
};

export function defaultOnboardingDraft(partial?: Partial<OnboardingDraft>): OnboardingDraft {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return {
    displayName: '',
    birthDate: partial?.birthDate ?? d,
    localPhotoUris: [],
    remotePhotoUrls: [],
    bio: '',
    interests: [],
    languages: [],
    meetingIntent: null,
    promptAnswers: [],
    selfGender: null,
    showMe: 'everyone',
    ageMin: 22,
    ageMax: 35,
    radiusKm: 25,
    profilePublic: true,
    safetyTipsAcknowledged: false,
    skipContactsImport: true,
    ...partial,
  };
}

export function preferencesFromDraft(draft: OnboardingDraft): ProfilePreferences {
  const base: ProfilePreferences = {
    languages: draft.languages,
    interests: draft.interests,
    meeting_intent: draft.meetingIntent ?? undefined,
    prompt_answers: draft.promptAnswers.map(({ promptId, prompt, answer }) => ({
      prompt_id: promptId,
      prompt,
      answer,
    })),
    show_me: draft.showMe,
    self_gender: draft.selfGender ?? undefined,
    distance_unit: 'km',
    safety_tips_acknowledged: draft.safetyTipsAcknowledged,
  };
  return base;
}
