import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { supabase } from '@/lib/supabase';
import type { DbMeetType, DbPlan, DbProfile } from '@/types/database';

/** Row returned by `plans` select with embedded `meet_types`. */
export type PlanRowFromDb = DbPlan & { meet_types?: DbMeetType | null };

const PROFILE_FIELDS =
  'user_id, display_name, avatar_url, primary_photo_url, birth_date, verified_badge, ai_trust_score, photo_urls, bio, onboarding_status, preferences';

type ProfileRow = Pick<
  DbProfile,
  | 'user_id'
  | 'display_name'
  | 'avatar_url'
  | 'primary_photo_url'
  | 'birth_date'
  | 'verified_badge'
  | 'ai_trust_score'
  | 'photo_urls'
  | 'bio'
  | 'onboarding_status'
  | 'preferences'
>;

export async function fetchPlansPage(
  from: number,
  to: number,
  viewerUserId: string | null
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

  let q = supabase
    .from('plans')
    .select('*, meet_types(*)')
    .eq('is_suppressed', false)
    .is('archived_at', null)
    .in('status', ['negotiating', 'active'])
    .or(moodOr)
    .or(notExpiredOr);

  if (viewerUserId) {
    q = q.or(`visibility.eq.public,visibility.eq.radius,creator_id.eq.${viewerUserId}`);
  } else {
    q = q.in('visibility', ['public', 'radius']);
  }

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { plans: [], error: error.message };
  return { plans: (data ?? []) as PlanRowFromDb[], error: null };
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
