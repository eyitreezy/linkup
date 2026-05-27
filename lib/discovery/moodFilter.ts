import type { PlanFeedRow } from '@/components/plans/planFeedTypes';

/** Horizontal “mood” chips — filter feed copy + plan signals (heuristic). */
export type DiscoveryMood = 'all' | 'chill' | 'active' | 'social' | 'premium';

const CHILL = ['coffee', 'chill', 'movie', 'read', 'tea', 'walk', 'park', 'cafe', 'brunch', 'relax', 'museum', 'gallery'];
const ACTIVE = ['run', 'gym', 'hike', 'sport', 'climb', 'bike', 'yoga', 'workout', 'fitness', 'swim', 'tennis', 'surf'];
const SOCIAL = ['party', 'club', 'bar', 'drinks', 'network', 'mixer', 'event', 'concert', 'dinner', 'karaoke', 'game night'];

function planTextBlob(row: PlanFeedRow): string {
  return `${row.title} ${row.description ?? ''} ${row.category ?? ''} ${row.meetType?.name ?? ''} ${row.meetType?.slug ?? ''}`.toLowerCase();
}

export function planMatchesDiscoveryMood(row: PlanFeedRow, mood: DiscoveryMood): boolean {
  if (mood === 'all') return true;

  const blob = planTextBlob(row);
  const now = Date.now();
  const boosted = !!(row.boosted_until && new Date(row.boosted_until).getTime() > now);
  const paidSignal = !!(row.is_paid || (row.starting_price_cents != null && row.starting_price_cents > 0));

  if (mood === 'premium') {
    return paidSignal || boosted || !!row.is_mood_plan;
  }

  /** Mood plans often won’t match chill/active/social keywords — still show them on those strips. */
  if (row.is_mood_plan) return true;

  const kw = mood === 'chill' ? CHILL : mood === 'active' ? ACTIVE : SOCIAL;
  return kw.some((k) => blob.includes(k));
}

export function filterPlansByMood(rows: PlanFeedRow[], mood: DiscoveryMood): PlanFeedRow[] {
  if (mood === 'all') return rows;
  return rows.filter((r) => planMatchesDiscoveryMood(r, mood));
}
