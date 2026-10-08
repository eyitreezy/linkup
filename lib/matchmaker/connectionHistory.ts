import { supabase } from '@/lib/supabase';

export type MatchMakerHistoryRow = {
  connection_id: string;
  ended_at: string;
  connected_at: string;
  first_plan_created_at: string | null;
  partner_id: string;
  partner_name: string | null;
  partner_avatar_url: string | null;
  primary_photo_url: string | null;
  outcome_label: 'ended' | 'plan created';
};

export function historyDurationDays(connectedAt: string, endedAt: string): number {
  const start = new Date(connectedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(1, Math.floor((end - start) / 86400000));
}

export function partnerAvatar(row: MatchMakerHistoryRow): string | null {
  return row.partner_avatar_url ?? row.primary_photo_url ?? null;
}

export async function fetchMatchMakerConnectionHistory(): Promise<MatchMakerHistoryRow[]> {
  const { data, error } = await supabase.rpc('matchmaker_get_connection_history');
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data as MatchMakerHistoryRow[];
}
