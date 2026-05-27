import type { PlanFeedRow } from '@/components/plans/planFeedTypes';

/** Shared labels for mood urgency + type in Discover and list cards. */
export function moodDiscoverMeta(row: PlanFeedRow): {
  showMood: boolean;
  urgencyLabel: string | null;
  moodTypeLabel: string | null;
  moodExpiresAt: string | null;
} {
  const showMood = !!row.is_mood_plan && !!row.mood_expires_at;
  const moodExpiresAt = row.mood_expires_at ?? null;
  const moodTypeLabel = row.mood_type ? row.mood_type.replace(/_/g, ' ') : null;
  const urgencyLabel =
    row.urgency_level === 'last_spot'
      ? 'Last spot'
      : row.urgency_level === 'ending_soon'
        ? 'Ending soon'
        : row.urgency_level === 'tonight_only'
          ? 'Tonight'
          : row.urgency_level === 'happening_now'
            ? 'Live now'
            : null;

  return { showMood, urgencyLabel, moodTypeLabel, moodExpiresAt };
}
