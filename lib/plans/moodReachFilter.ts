import { distanceKm } from '@/lib/location';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import type { DbPlan } from '@/types/database';

export type MoodReach = 'city' | 'city_adjacent' | 'city_widest' | 'all_cities';

/** Flat absolute km from plan meetup location, stamped at publish from creator tier. */
export const MOOD_REACH_KM: Record<MoodReach, number | null> = {
  city: 25,
  city_adjacent: 50,
  city_widest: 100,
  all_cities: null,
};

export const MOOD_REACH_LABELS: Record<MoodReach, string> = {
  city: 'City-wide · 25km',
  city_adjacent: 'City + nearby · 50km',
  city_widest: 'Widest reach · 100km',
  all_cities: 'All cities',
};

/** Reach label shown in create wizard from the creator's effective tier. */
export const MOOD_REACH_LABELS_BY_TIER: Record<SubscriptionTier, string> = {
  FREE: MOOD_REACH_LABELS.city,
  SILVER: MOOD_REACH_LABELS.city_adjacent,
  GOLD: MOOD_REACH_LABELS.city_widest,
  PLATINUM: MOOD_REACH_LABELS.all_cities,
};

/**
 * Whether a mood plan's stamped reach allows the viewer at their search origin.
 * Uses plan meetup coordinates only — viewer radius preference is irrelevant.
 */
export function moodReachVisibleToViewer(
  plan: Pick<DbPlan, 'is_mood_plan' | 'mood_reach' | 'latitude' | 'longitude' | 'creator_id'>,
  viewerUserId: string | null,
  viewerLat: number | null,
  viewerLng: number | null
): boolean {
  if (!plan.is_mood_plan) return true;
  if (viewerUserId && plan.creator_id === viewerUserId) return true;

  const reach = (plan.mood_reach ?? 'city') as MoodReach;
  const reachKm = MOOD_REACH_KM[reach];

  if (reachKm === null) return true;

  if (plan.latitude == null || plan.longitude == null || viewerLat == null || viewerLng == null) {
    return false;
  }

  const dist = distanceKm(viewerLat, viewerLng, plan.latitude, plan.longitude);
  return dist <= reachKm;
}
