import type { PlanDraft } from '@/types/planDraft';
import { computeMoodExpiresAt } from '@/lib/plans/moodPlanComputations';

/** Mood plans go live at creation — never backdated or scheduled in the future. */
export function moodPlanScheduledNow(): Date {
  return new Date();
}

export function applyMoodPlanLiveNow(draft: PlanDraft): PlanDraft {
  const scheduledAt = moodPlanScheduledNow();
  const moodExpiresAt = computeMoodExpiresAt({
    scheduledAt,
    listingHours: draft.moodListingHours,
    window: draft.moodWindow,
    customStart: draft.moodCustomStart,
    customEnd: draft.moodCustomEnd,
  });
  let moodCustomStart = draft.moodCustomStart;
  let moodCustomEnd = draft.moodCustomEnd;
  const now = scheduledAt;
  if (draft.moodWindow === 'custom') {
    if (!moodCustomStart || moodCustomStart.getTime() < now.getTime()) {
      moodCustomStart = now;
    }
    if (!moodCustomEnd || moodCustomEnd.getTime() <= moodCustomStart.getTime()) {
      moodCustomEnd = new Date(moodCustomStart.getTime() + 2 * 3600000);
    }
  }
  return {
    ...draft,
    scheduledAt,
    moodExpiresAt,
    moodCustomStart,
    moodCustomEnd,
  };
}
