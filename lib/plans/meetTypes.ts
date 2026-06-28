import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbMeetType, MeetTypeApprovalStatus } from '@/types/database';

let cache: DbMeetType[] | null = null;
let cacheUserId: string | null | undefined = undefined;
let cacheAt = 0;
const TTL_MS = 60_000;

export function isMeetTypePendingForUser(type: DbMeetType, userId: string | undefined): boolean {
  return type.approval_status === 'pending' && !!userId && type.created_by === userId;
}

export function isMeetTypeSelectable(type: DbMeetType): boolean {
  const status = (type.approval_status ?? 'approved') as MeetTypeApprovalStatus;
  return type.is_active && status === 'approved';
}

export async function fetchActiveMeetTypes(): Promise<{ rows: DbMeetType[]; error: string | null }> {
  return fetchMeetTypesForUser(undefined);
}

/** Active catalog types + user's own pending submissions. */
export async function fetchMeetTypesForUser(
  userId: string | undefined
): Promise<{ rows: DbMeetType[]; error: string | null }> {
  if (!isSupabaseConfigured) return { rows: [], error: 'Not configured' };
  const now = Date.now();
  const uid = userId ?? null;
  if (cache && cacheUserId === uid && now - cacheAt < TTL_MS) {
    return { rows: cache, error: null };
  }

  let query = supabase.from('meet_types').select('*').order('sort_order', { ascending: true });

  if (uid) {
    query = query.or(`is_active.eq.true,and(created_by.eq.${uid},approval_status.eq.pending)`);
  } else {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };

  cache = (data ?? []) as DbMeetType[];
  cacheUserId = uid;
  cacheAt = now;
  return { rows: cache, error: null };
}

export function invalidateMeetTypesCache(): void {
  cache = null;
  cacheUserId = undefined;
  cacheAt = 0;
}

/** Catalog / seeded meet types have `created_by` NULL. */
export function isCatalogMeetType(type: DbMeetType): boolean {
  return !type.created_by;
}

/** Default catalog types plus types the signed-in user created — excludes other users' custom types. */
export function filterMeetTypesVisibleToUser(
  rows: DbMeetType[],
  userId: string | undefined
): DbMeetType[] {
  return rows.filter((t) => isCatalogMeetType(t) || (!!userId && t.created_by === userId));
}
