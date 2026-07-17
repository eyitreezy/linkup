import { supabase } from '@/lib/supabase';
import type { DbPlanJoinRequest, JoinRequestStatus } from '@/types/database';

export type JoinRequestWithRequester = DbPlanJoinRequest & {
  requester?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function submitJoinRequest(
  planId: string,
  message?: string
): Promise<{ requestId: string }> {
  const { data, error } = await supabase.rpc('submit_join_request', {
    p_plan_id: planId,
    p_message: message ?? null,
  });

  if (error) throw error;
  return { requestId: data as string };
}

export async function respondToJoinRequest(
  requestId: string,
  action: 'approve' | 'decline'
): Promise<void> {
  const { error } = await supabase.rpc('host_respond_to_join_request', {
    p_request_id: requestId,
    p_action: action,
  });

  if (error) throw error;
}

export async function fetchMyJoinRequest(
  planId: string,
  userId: string
): Promise<{ id: string; status: JoinRequestStatus } | null> {
  const { data } = await supabase
    .from('plan_join_requests')
    .select('id, status')
    .eq('plan_id', planId)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as { id: string; status: JoinRequestStatus } | null;
}

export async function fetchPlanJoinRequests(planId: string): Promise<JoinRequestWithRequester[]> {
  const { data: rows, error } = await supabase
    .from('plan_join_requests')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const list = (rows ?? []) as DbPlanJoinRequest[];
  if (list.length === 0) return [];

  const ids = [...new Set(list.map((r) => r.requester_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', ids);

  const byId = new Map(
    (profs ?? []).map((p) => [
      p.user_id,
      { display_name: p.display_name, avatar_url: p.avatar_url },
    ])
  );

  return list.map((row) => ({
    ...row,
    requester: byId.get(row.requester_id) ?? null,
  }));
}

export async function fetchGuestEscrowIdForJoinRequest(
  planId: string,
  requesterId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('escrow_transactions')
    .select('id')
    .eq('plan_id', planId)
    .eq('guest_id', requesterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
