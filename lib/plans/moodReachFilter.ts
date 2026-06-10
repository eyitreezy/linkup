import { distanceKm } from '@/lib/location';
import type { DbPlan } from '@/types/database';

export type MoodReach = 'city' | 'city_adjacent' | 'city_widest' | 'all_cities';

/** Multiplier on viewer discovery radius for mood reach tiers. */
const REACH_RADIUS_MULT: Record<MoodReach, number | null> = {
  city: 1,
  city_adjacent: 1.5,
  city_widest: 2.5,
  all_cities: null,
};

/**
 * Whether a mood plan's stamped reach allows the viewer at their coordinates.
 */
export function moodReachVisibleToViewer(
  plan: Pick<DbPlan, 'is_mood_plan' | 'mood_reach' | 'latitude' | 'longitude' | 'creator_id'>,
  viewerUserId: string | null,
  viewerLat: number | null,
  viewerLng: number | null,
  viewerRadiusKm: number
): boolean {
  if (!plan.is_mood_plan) return true;
  if (viewerUserId && plan.creator_id === viewerUserId) return true;

  const reach = (plan.mood_reach ?? 'city') as MoodReach;
  if (reach === 'all_cities') return true;

  if (plan.latitude == null || plan.longitude == null || viewerLat == null || viewerLng == null) {
    return reach === 'city';
  }

  const mult = REACH_RADIUS_MULT[reach] ?? 1;
  const maxKm = viewerRadiusKm * mult;
  const dist = distanceKm(viewerLat, viewerLng, plan.latitude, plan.longitude);
  return dist <= maxKm;
}
