import { mapDbProfileToPoolProfile } from '@/lib/matchmaker/profile';
import type { MatchMakerInterestItem, MatchMakerInterestQueue } from '@/lib/matchmaker/types';
import { supabase } from '@/lib/supabase';
import type { DbProfile } from '@/types/database';

type InterestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  expressed_at: string;
  status: string;
  expires_at: string;
};

async function loadProfiles(userIds: string[]): Promise<Map<string, DbProfile>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.from('profiles').select('*').in('user_id', unique);
  if (error) throw error;

  const map = new Map<string, DbProfile>();
  for (const row of data ?? []) {
    map.set(String((row as DbProfile).user_id), row as DbProfile);
  }
  return map;
}

function toInterestItem(
  row: InterestRow,
  viewerId: string,
  profiles: Map<string, DbProfile>
): MatchMakerInterestItem | null {
  const counterpartyId = row.from_user_id === viewerId ? row.to_user_id : row.from_user_id;
  const profile = profiles.get(counterpartyId);
  if (!profile) return null;

  return {
    id: row.id,
    from_user_id: row.from_user_id,
    to_user_id: row.to_user_id,
    expressed_at: row.expressed_at,
    status: row.status as MatchMakerInterestItem['status'],
    expires_at: row.expires_at,
    profile: mapDbProfileToPoolProfile(profile),
  };
}

/** Pending interests for the signed-in user (sent + received). */
export async function fetchMatchMakerInterestQueue(viewerId: string): Promise<MatchMakerInterestQueue> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('matchmaker_interests')
    .select('id, from_user_id, to_user_id, expressed_at, status, expires_at')
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .or(`from_user_id.eq.${viewerId},to_user_id.eq.${viewerId}`)
    .order('expressed_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as InterestRow[];
  const profileIds = rows.flatMap((row) => [row.from_user_id, row.to_user_id]);
  const profiles = await loadProfiles(profileIds);

  const sent: MatchMakerInterestItem[] = [];
  const received: MatchMakerInterestItem[] = [];

  for (const row of rows) {
    const item = toInterestItem(row, viewerId, profiles);
    if (!item) continue;
    if (row.from_user_id === viewerId) sent.push(item);
    else if (row.to_user_id === viewerId) received.push(item);
  }

  return { sent, received };
}

export async function fetchMatchMakerReceivedInterestCount(viewerId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from('matchmaker_interests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('to_user_id', viewerId)
    .gt('expires_at', nowIso);

  if (error) throw error;
  return count ?? 0;
}

/** Pending received interests not yet opened in the queue screen. */
export async function fetchMatchMakerUnopenedReceivedCount(
  viewerId: string,
  lastOpenedAt: string | null
): Promise<number> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from('matchmaker_interests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('to_user_id', viewerId)
    .gt('expires_at', nowIso);

  if (lastOpenedAt) {
    query = query.gt('expressed_at', lastOpenedAt);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
