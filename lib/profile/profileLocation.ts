import type { OnboardingDraft } from '@/types/onboarding';

export type ProfileLocationPatch = {
  locationLabel: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
};

/** Profile row patch for location_label + coordinates. */
export function profileLocationFromDraft(draft: OnboardingDraft) {
  return {
    location_label: draft.locationLabel.trim() || null,
    latitude: draft.locationLatitude,
    longitude: draft.locationLongitude,
  };
}

/** Location must be chosen from search or “use current location” (coords + label). */
export function hasValidProfileLocation(draft: OnboardingDraft): boolean {
  return (
    draft.locationLabel.trim().length > 0 &&
    draft.locationLatitude != null &&
    draft.locationLongitude != null &&
    Number.isFinite(draft.locationLatitude) &&
    Number.isFinite(draft.locationLongitude)
  );
}
