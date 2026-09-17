import { supabase } from '@/lib/supabase';
import type { MatchMakerPoolProfile } from '@/lib/matchmaker/types';

/** Uses linkup-web RPC: `matchmaker_get_pool(p_limit)` → JSONB array. */
export async function fetchMatchMakerPool(limit = 20): Promise<MatchMakerPoolProfile[]> {
  const { data, error } = await supabase.rpc('matchmaker_get_pool', {
    p_limit: limit,
  });
  if (error) throw error;
  const rows = Array.isArray(data)
    ? data
    : typeof data === 'string'
      ? (JSON.parse(data) as unknown[])
      : [];
  return rows.map((row) => normalizePoolRow(row as Record<string, unknown>));
}

export async function expressMatchMakerInterest(toUserId: string): Promise<{
  matched: boolean;
  connection_id?: string;
  queued?: boolean;
}> {
  const { data, error } = await supabase.rpc('matchmaker_express_interest', {
    p_to_user_id: toUserId,
  });
  if (error) throw error;
  return (data ?? { matched: false }) as {
    matched: boolean;
    connection_id?: string;
    queued?: boolean;
  };
}

export async function passMatchMakerInterest(_toUserId: string): Promise<void> {
  // Server-side pass can be added later; client removes card locally for MVP.
}

function normalizePoolRow(row: Record<string, unknown>): MatchMakerPoolProfile {
  const preferences = row.preferences as { interests?: string[] } | null | undefined;
  const interests = Array.isArray(row.interests)
    ? (row.interests as string[])
    : Array.isArray(preferences?.interests)
      ? preferences.interests
      : [];
  const photoUrls = row.photo_urls as string[] | null | undefined;
  const avatar =
    (row.avatar_url as string | null) ??
    (row.primary_photo_url as string | null) ??
    (Array.isArray(photoUrls) ? photoUrls[0] : null);

  return {
    user_id: String(row.user_id),
    display_name: (row.display_name as string | null) ?? null,
    birth_date: (row.birth_date as string | null) ?? null,
    avatar_url: avatar,
    location_label: (row.location_label as string | null) ?? null,
    verified_badge: Boolean(row.verified_badge),
    bio: (row.bio as string | null) ?? null,
    interests,
    communication_style: (row.communication_style as string | null) ?? null,
    distance_km: null,
  };
}
