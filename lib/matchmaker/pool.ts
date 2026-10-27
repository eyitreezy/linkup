import type { MatchMakerPoolFetchFilter } from '@/lib/matchmaker/filterState';
import { supabase } from '@/lib/supabase';
import type {
  MatchMakerPoolEmptyReason,
  MatchMakerPoolProfile,
  MatchMakerPoolResult,
} from '@/lib/matchmaker/types';

const EMPTY_REASONS = [
  'gender_not_set',
  'dealbreakers_strict',
  'location_narrow',
  'genuinely_empty',
] as const;

/** Uses linkup-web RPC: `matchmaker_get_pool(...)` → JSONB envelope. */
export async function fetchMatchMakerPool(
  limit = 20,
  filter?: MatchMakerPoolFetchFilter
): Promise<MatchMakerPoolResult> {
  const { data, error } = await supabase.rpc('matchmaker_get_pool', {
    p_limit: limit,
    p_max_distance_km: filter?.maxDistanceKm ?? null,
    p_sort_by: filter?.sortBy ?? 'best_match',
  });
  if (error) throw error;
  return parsePoolRpcEnvelope(data);
}

export type MatchMakerExpressInterestResult = {
  matched: boolean;
  connection_id?: string;
  queued?: boolean;
  surfaced?: boolean;
  already_sent?: boolean;
  interest_status?: string;
};

export async function expressMatchMakerInterest(
  toUserId: string
): Promise<MatchMakerExpressInterestResult> {
  const { data, error } = await supabase.rpc('matchmaker_express_interest', {
    p_to_user_id: toUserId,
  });
  if (error) throw error;
  return (data ?? { matched: false }) as MatchMakerExpressInterestResult;
}

/** Persistent pool/profile pass (viewer passes target). */
export async function passMatchMakerProfile(toUserId: string): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_pass_pool_profile', {
    p_to_user_id: toUserId,
  });
  if (error) throw error;
}

/** Decline a received pending interest in the queue. */
export async function passMatchMakerInterest(fromUserId: string): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_pass_interest', {
    p_from_user_id: fromUserId,
  });
  if (error) throw error;
}

/** Blurred gate backdrop — real profiles, no dealbreaker filters for gated users. */
export async function fetchMatchMakerPoolPreview(limit = 6): Promise<MatchMakerPoolProfile[]> {
  const { data, error } = await supabase.rpc('matchmaker_get_pool_preview', {
    p_limit: limit,
  });
  if (error) throw error;
  const { profiles } = parsePoolRpcEnvelope(data);
  return profiles;
}

function parsePoolRpcEnvelope(data: unknown): MatchMakerPoolResult {
  if (data == null) {
    return { profiles: [], emptyReason: null };
  }

  let payload: unknown = data;
  if (typeof data === 'string') {
    payload = JSON.parse(data) as unknown;
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'profiles' in payload) {
    const envelope = payload as Record<string, unknown>;
    const rows = Array.isArray(envelope.profiles) ? envelope.profiles : [];
    return {
      profiles: rows.map((row) => normalizePoolRow(row as Record<string, unknown>)),
      emptyReason: normalizeEmptyReason(envelope.empty_reason),
    };
  }

  if (Array.isArray(payload)) {
    return {
      profiles: payload.map((row) => normalizePoolRow(row as Record<string, unknown>)),
      emptyReason: null,
    };
  }

  return { profiles: [], emptyReason: null };
}

function normalizeEmptyReason(value: unknown): MatchMakerPoolEmptyReason {
  if (typeof value !== 'string') return null;
  return EMPTY_REASONS.includes(value as (typeof EMPTY_REASONS)[number])
    ? (value as MatchMakerPoolEmptyReason)
    : null;
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

  const distanceRaw = row.distance_km;
  const distance_km =
    typeof distanceRaw === 'number'
      ? distanceRaw
      : typeof distanceRaw === 'string' && distanceRaw.trim() !== ''
        ? Number(distanceRaw)
        : null;

  const viewerState =
    typeof row.viewer_state === 'string'
      ? row.viewer_state
      : typeof row.interaction === 'object' && row.interaction && 'viewer_state' in row.interaction
        ? String((row.interaction as { viewer_state?: string }).viewer_state ?? '')
        : '';

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
    distance_km: Number.isFinite(distance_km) ? distance_km : null,
    viewer_interest_pending: viewerState === 'interest_sent',
  };
}
