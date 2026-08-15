import { supabase } from '@/lib/supabase';
import { isPlanParticipationClosed } from '@/lib/plans/planExpiry';
import { mapInvitationRpcError } from '@/lib/plans/invitationErrors';
import type { InvitationStatus } from '@/types/database';

export type InvitationSearchResult = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_kyc_verified: boolean;
  already_invited: boolean;
  already_member: boolean;
  gender: string | null;
};

export type PlanInvitationRow = {
  id: string;
  plan_id: string;
  host_id: string;
  invitee_user_id: string | null;
  invitee_email: string | null;
  status: InvitationStatus;
  slot_held: boolean;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  invitee?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type PlanInviteDetails = {
  name: string;
  hostName: string;
  meetType?: string;
  planDate?: string;
  planLocation?: string;
  shareAmountCents?: number;
};

function rpcErrorCode(error: { message?: string; details?: string }): string {
  return (error.message ?? error.details ?? '').toLowerCase();
}

async function parseEdgeFunctionError(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: Response };
  if (err.context) {
    try {
      const body = (await err.context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // fall through
    }
  }
  const msg = err.message ?? '';
  if (msg === 'misconfigured') return 'misconfigured';
  if (msg.toLowerCase().includes('unauthorized')) return 'not_plan_host';
  return msg || 'invitation_failed';
}

export async function getPlanAvailableSlots(planId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_plan_available_slots', {
      p_plan_id: planId,
    });
    if (error) return 0;
    return typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
}

async function assertPlanAllowsInvitations(planId: string): Promise<void> {
  const { data, error } = await supabase
    .from('plans')
    .select('is_mood_plan, is_expired, mood_expires_at, active_expires_at, status')
    .eq('id', planId)
    .maybeSingle();
  if (error || !data) throw new Error('plan_not_found');
  if (isPlanParticipationClosed(data)) throw new Error('PLAN_EXPIRED');
}

export async function sendInvitationToUser(
  planId: string,
  inviteeUserId: string,
  _planDetails?: PlanInviteDetails
): Promise<{ invitationId: string }> {
  await assertPlanAllowsInvitations(planId);
  const { data, error } = await supabase.rpc('send_plan_invitation_to_user', {
    p_plan_id: planId,
    p_invitee_user_id: inviteeUserId,
  });

  if (error) {
    const code = rpcErrorCode(error);
    if (code.includes('no_slots_available')) throw new Error('NO_SLOTS');
    if (code.includes('invitation_already_exists')) throw new Error('ALREADY_INVITED');
    if (code.includes('plan_expired') || code.includes('plan_not_available')) {
      throw new Error('PLAN_EXPIRED');
    }
    throw error;
  }

  return { invitationId: data as string };
}

export async function sendInvitationByEmail(
  planId: string,
  inviteeEmail: string,
  planDetails: PlanInviteDetails
): Promise<{ invitationId: string }> {
  await assertPlanAllowsInvitations(planId);

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .ilike('email', inviteeEmail.trim())
    .maybeSingle();

  if (existingUser?.id) {
    return sendInvitationToUser(planId, existingUser.id, planDetails);
  }

  const shareLabel = planDetails.shareAmountCents
    ? formatInviteShare(planDetails.shareAmountCents, 'NGN')
    : undefined;

  const { data, error } = await supabase.functions.invoke('send-plan-invitation-email', {
    body: {
      planId,
      inviteeEmail: inviteeEmail.trim(),
      planDetails: {
        name: planDetails.name,
        hostName: planDetails.hostName,
        meetType: planDetails.meetType,
        planDate: planDetails.planDate,
        shareAmount: shareLabel,
      },
    },
  });

  if (error) {
    const code = await parseEdgeFunctionError(error);
    throw new Error(code);
  }
  const payload = data as { invitationId?: string; error?: string };
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.invitationId) throw new Error('invitation_failed');
  return { invitationId: payload.invitationId };
}

export async function respondToInvitation(
  invitationId: string,
  action: 'accept' | 'decline',
  declineReason?: string | null,
  declineReasonOther?: string | null
): Promise<{
  action: string;
  isNegotiable: boolean;
  offerId?: string;
  escrowId?: string;
  slotAmountCents?: number;
}> {
  const { data, error } = await supabase.rpc('respond_to_plan_invitation', {
    p_invitation_id: invitationId,
    p_action: action,
    p_decline_reason: declineReason ?? null,
    p_decline_reason_other: declineReasonOther ?? null,
  });

  if (error) {
    const mapped = mapInvitationRpcError(error.message ?? '');
    if (mapped !== (error.message ?? '')) {
      throw new Error(mapped);
    }
    console.error('[respondToInvitation]', error);
    throw new Error(error.message || 'UNKNOWN_ERROR');
  }

  return data as {
    action: string;
    isNegotiable: boolean;
    offerId?: string;
    escrowId?: string;
    slotAmountCents?: number;
  };
}

export async function searchUsersForInvitation(
  query: string,
  planId: string
): Promise<InvitationSearchResult[]> {
  try {
    const { data, error } = await supabase.rpc('search_users_for_invitation', {
      p_query: query,
      p_plan_id: planId,
    });
    if (error) return [];
    return ((data ?? []) as InvitationSearchResult[]).map((row) => ({
      ...row,
      already_member: row.already_member ?? false,
      gender: row.gender ?? null,
    }));
  } catch {
    return [];
  }
}

export async function fetchPlanInvitations(planId: string): Promise<PlanInvitationRow[]> {
  try {
    const { data: rows, error } = await supabase
      .from('plan_invitations')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false });

    if (error) return [];
    const list = (rows ?? []) as PlanInvitationRow[];
    if (list.length === 0) return [];

    const userIds = [
      ...new Set(list.map((r) => r.invitee_user_id).filter((id): id is string => Boolean(id))),
    ];
    if (userIds.length === 0) return list;

    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    const byId = new Map(
      (profs ?? []).map((p) => [
        p.user_id,
        { display_name: p.display_name, avatar_url: p.avatar_url },
      ])
    );

    return list.map((row) => ({
      ...row,
      invitee: row.invitee_user_id ? byId.get(row.invitee_user_id) ?? null : null,
    }));
  } catch {
    return [];
  }
}

export async function fetchMyInvitation(
  invitationId: string
): Promise<PlanInvitationRow | null> {
  const { data, error } = await supabase
    .from('plan_invitations')
    .select('*')
    .eq('id', invitationId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlanInvitationRow) ?? null;
}

export async function countPendingInvitations(planId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('plan_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', planId)
      .eq('status', 'pending');
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('plan_invitations')
    .update({ status: 'cancelled', slot_held: false })
    .eq('id', invitationId)
    .eq('status', 'pending');
  if (error) throw error;
}

export async function linkInvitationAfterSignup(token: string): Promise<{
  linked: boolean;
  planId?: string;
  invitationId?: string;
}> {
  const { data, error } = await supabase.rpc('link_invitation_after_signup', {
    p_token: token,
  });
  if (error) throw error;
  const row = data as { linked?: boolean; planId?: string; invitationId?: string };
  return {
    linked: Boolean(row?.linked),
    planId: row?.planId,
    invitationId: row?.invitationId,
  };
}

function formatInviteShare(cents: number, currency: string): string {
  const major = cents / 100;
  if (currency === 'NGN') {
    return `₦${major.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }
  return `${currency} ${major.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
