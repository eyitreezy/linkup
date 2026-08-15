import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';

export type PlanTypeBadgeKey = 'group' | 'mood' | 'mood_urgency' | 'standard';

export type PlanTypeBadgeSpec = {
  key: PlanTypeBadgeKey;
  label: string;
  tone: 'group' | 'mood' | 'mood_urgency' | 'neutral';
};

type PlanTypeSource = Pick<PlanFeedRow, 'is_group_plan' | 'is_mood_plan'> &
  Parameters<typeof moodDiscoverMeta>[0];

/** Shared plan-type badges for Discover swipe and list views. */
export function planTypeBadges(row: PlanTypeSource): PlanTypeBadgeSpec[] {
  const badges: PlanTypeBadgeSpec[] = [];
  const moodMeta = moodDiscoverMeta(row);

  if (row.is_group_plan) {
    badges.push({ key: 'group', label: 'GROUP', tone: 'group' });
  }

  if (moodMeta.showMood) {
    if (moodMeta.urgencyLabel) {
      badges.push({
        key: 'mood_urgency',
        label: moodMeta.urgencyLabel,
        tone: 'mood_urgency',
      });
    }
    if (moodMeta.moodTypeLabel) {
      badges.push({ key: 'mood', label: moodMeta.moodTypeLabel, tone: 'mood' });
    }
  }

  if (!badges.length) {
    badges.push({ key: 'standard', label: 'Meetup', tone: 'neutral' });
  }

  return badges;
}
