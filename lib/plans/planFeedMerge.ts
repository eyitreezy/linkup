import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import {
  discoverPriceFilterBounds,
  hasDiscoverPriceFilter,
  type DiscoverPriceFilter,
} from '@/lib/discovery/discoverPriceFilter';
import { distanceKm } from '@/lib/location';
import { fetchConnectedCreatorIds } from '@/lib/plans/discoverConnections';
import { RADIUS_VISIBILITY_KM } from '@/lib/plans/planVisibilityConfig';
import { filterTierRelativePremiumVisibilityPlans } from '@/lib/plans/tierRelativePremiumVisibility';
import { supabase } from '@/lib/supabase';
import type { DbMeetType, DbPlan, DbProfile, SubscriptionTier } from '@/types/database';

/** Row returned by `plans` select with embedded `meet_types`. */
export type PlanRowFromDb = DbPlan & { meet_types?: DbMeetType | null };

const PROFILE_FIELDS =
  'user_id, display_name, avatar_url, primary_photo_url, birth_date, verified_badge, subscription_badge, ai_trust_score, photo_urls, bio, onboarding_status, preferences, spotlight_until, masked_activity_enabled';

type ProfileRow = Pick<
  DbProfile,
  | 'user_id'
  | 'display_name'
  | 'avatar_url'
  | 'primary_photo_url'
  | 'birth_date'
  | 'verified_badge'
  | 'subscription_badge'
  | 'ai_trust_score'
  | 'photo_urls'
  | 'bio'
  | 'onboarding_status'
  | 'preferences'
  | 'spotlight_until'
  | 'masked_activity_enabled'
>;

/** Defence-in-depth for visibility='premium' — tier-relative audience vs viewer. */
export function filterPremiumVisibilityPlans(
  rows: PlanFeedRow[],
  viewerTier: SubscriptionTier,
  viewerUserId: string | null,
  viewerLat: number | null,
  viewerLng: number | null
): PlanFeedRow[] {
  return filterTierRelativePremiumVisibilityPlans(
    rows,
    viewerUserId,
    viewerTier,
    viewerLat,
    viewerLng
  );
}

/** Defence-in-depth for visibility='radius' — uses viewer search origin, not profile-only RLS. */
export function filterRadiusVisibilityPlans(
  rows: PlanFeedRow[],
  viewerUserId: string | null,
  viewerLat: number | null,
  viewerLng: number | null
): PlanFeedRow[] {
  return rows.filter((plan) => {
    if (plan.visibility !== 'radius') return true;
    if (viewerUserId && plan.creator_id === viewerUserId) return true;
    if (plan.latitude == null || plan.longitude == null) return true;
    if (viewerLat == null || viewerLng == null) return false;
    const distance = distanceKm(viewerLat, viewerLng, plan.latitude, plan.longitude);
    return distance <= RADIUS_VISIBILITY_KM;
  });
}

export async function fetchPlansPage(
  from: number,
  to: number,
  viewerUserId: string | null,
  priceFilter?: DiscoverPriceFilter | null
): Promise<{ plans: PlanRowFromDb[]; error: string | null }> {
  const nowIso = new Date().toISOString();
  /** PostgREST prefers quoted timestamptz when the value contains `:` */
  const nowQuoted = `"${nowIso}"`;
  /** Mood discover TTL: hide other people’s *expired* mood rows; always keep the viewer’s own (incl. expired). */
  const moodOr = viewerUserId
    ? `is_mood_plan.eq.false,mood_expires_at.is.null,creator_id.eq.${viewerUserId},mood_expires_at.gt.${nowQuoted}`
    : `is_mood_plan.eq.false,mood_expires_at.is.null,mood_expires_at.gt.${nowQuoted}`;

  /** Creator shelf + management still need expired rows; public discover excludes them. */
  const notExpiredOr = viewerUserId
    ? `is_expired.eq.false,creator_id.eq.${viewerUserId}`
    : `is_expired.eq.false`;

  /** Standard plan active window — legacy rows without active_expires_at remain visible. */
  const activeWindowOr = viewerUserId
    ? `is_mood_plan.eq.true,active_expires_at.is.null,creator_id.eq.${viewerUserId},active_expires_at.gt.${nowQuoted}`
    : `is_mood_plan.eq.true,active_expires_at.is.null,active_expires_at.gt.${nowQuoted}`;

  let connectedCreatorIds: string[] = [];
  if (viewerUserId) {
    try {
      connectedCreatorIds = await fetchConnectedCreatorIds(viewerUserId);
    } catch {
      connectedCreatorIds = [];
    }
  }

  let q = supabase
    .from('plans')
    .select('*, meet_types(*)')
    .eq('is_suppressed', false)
    .is('archived_at', null)
    .in('status', ['negotiating', 'active'])
    .or(moodOr)
    .or(notExpiredOr)
    .or(activeWindowOr);

  if (viewerUserId) {
    const visParts = [
      'visibility.eq.public',
      'visibility.eq.radius',
      'visibility.eq.premium',
      `creator_id.eq.${viewerUserId}`,
    ];
    if (connectedCreatorIds.length > 0) {
      visParts.push(
        `and(visibility.eq.friends,creator_id.in.(${connectedCreatorIds.join(',')}))`
      );
    }
    q = q.or(visParts.join(','));
  } else {
    q = q.in('visibility', ['public', 'radius']);
  }

  if (priceFilter && hasDiscoverPriceFilter(priceFilter)) {
    const { minPriceCents, maxPriceCents } = discoverPriceFilterBounds(priceFilter);
    if (minPriceCents != null) {
      q = q.gte('starting_price_cents', minPriceCents);
    }
    if (maxPriceCents != null) {
      q = q.lte('starting_price_cents', maxPriceCents);
    }
  }

  const { data, error } = await q
    .order('host_tier_rank', { ascending: false, nullsFirst: false })
    .order('boosted_until', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { plans: [], error: error.message };
  const rows = (data ?? []) as PlanRowFromDb[];
  const filtered = rows.filter((plan) => {
    if (!plan.is_group_plan) return true;
    const accepted = plan.accepted_guest_count ?? 0;
    const max = plan.max_guests;
    if (max == null) return true;
    return accepted < max;
  });
  return { plans: filtered, error: null };
}

export async function fetchProfilesForCreators(creatorIds: string[]): Promise<Map<string, ProfileRow>> {
  const unique = [...new Set(creatorIds)].filter(Boolean);
  const map = new Map<string, ProfileRow>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).in('user_id', unique);
  if (error || !data) return map;
  for (const row of data as ProfileRow[]) {
    map.set(row.user_id, row);
  }
  return map;
}

export function mergePlansWithProfiles(plans: PlanRowFromDb[], profiles: Map<string, ProfileRow>): PlanFeedRow[] {
  return plans.map((p) => {
    const { meet_types: mt, ...rest } = p;
    return {
      ...(rest as DbPlan),
      meetType: mt ?? null,
      creatorProfile: profiles.get(p.creator_id) ?? null,
      creatorVerification: null,
    };
  });
}
