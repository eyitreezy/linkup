import type { PlanFeedRow } from '@/components/plans/planFeedTypes';

/**
 * Mood plans first (soonest expiry), then recency.
 */
export function rankDiscoveryPlans(rows: PlanFeedRow[]): PlanFeedRow[] {
  return [...rows].sort((a, b) => {
    const ma = a.is_mood_plan && a.mood_expires_at ? new Date(a.mood_expires_at).getTime() : Infinity;
    const mb = b.is_mood_plan && b.mood_expires_at ? new Date(b.mood_expires_at).getTime() : Infinity;
    if (a.is_mood_plan !== b.is_mood_plan) return a.is_mood_plan ? -1 : 1;
    if (a.is_mood_plan && b.is_mood_plan && ma !== mb) return ma - mb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
