import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { supabase } from '@/lib/supabase';
import type { DbPlan, DbProfile } from '@/types/database';

const PROFILE_FIELDS =
  'user_id, display_name, avatar_url, verified_badge, ai_trust_score, photo_urls, bio, onboarding_status, preferences';

type ProfileRow = Pick<
  DbProfile,
  | 'user_id'
  | 'display_name'
  | 'avatar_url'
  | 'verified_badge'
  | 'ai_trust_score'
  | 'photo_urls'
  | 'bio'
  | 'onboarding_status'
  | 'preferences'
>;

export async function fetchPlansPage(from: number, to: number): Promise<{ plans: DbPlan[]; error: string | null }> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .in('status', ['negotiating', 'active'])
    .in('visibility', ['public', 'radius'])
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { plans: [], error: error.message };
  return { plans: (data ?? []) as DbPlan[], error: null };
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

export function mergePlansWithProfiles(plans: DbPlan[], profiles: Map<string, ProfileRow>): PlanFeedRow[] {
  return plans.map((p) => ({
    ...p,
    creatorProfile: profiles.get(p.creator_id) ?? null,
    creatorVerification: null,
  }));
}
