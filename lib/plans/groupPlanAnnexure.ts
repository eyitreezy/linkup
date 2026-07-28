import { supabase } from '@/lib/supabase';

export const GROUP_PLAN_POLICY_VERSION = 'v1.0';

export async function hasGroupPlanPolicySignoff(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('group_plan_policy_signoffs')
    .select('id')
    .eq('user_id', userId)
    .eq('policy_version', GROUP_PLAN_POLICY_VERSION)
    .maybeSingle();
  return !!data;
}

export async function hasEscrowPolicySignoff(planId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('escrow_policy_signoffs')
    .select('id')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function hasSafetyCaveatAck(planId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('safety_caveat_acknowledgements')
    .select('id')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/** True when these two users have never completed a plan together. */
export async function isFirstMeetupPair(userId: string, counterpartyId: string): Promise<boolean> {
  const { data: hostSide } = await supabase
    .from('plan_offers')
    .select('plan_id, plans!inner(id, status, creator_id)')
    .eq('bidder_id', counterpartyId)
    .eq('status', 'accepted')
    .eq('plans.creator_id', userId)
    .eq('plans.status', 'completed')
    .limit(1);
  if (hostSide?.length) return false;

  const { data: guestSide } = await supabase
    .from('plan_offers')
    .select('plan_id, plans!inner(id, status, creator_id)')
    .eq('bidder_id', userId)
    .eq('status', 'accepted')
    .eq('plans.creator_id', counterpartyId)
    .eq('plans.status', 'completed')
    .limit(1);
  return !(guestSide?.length);
}

export async function needsSafetyCaveatGate(
  planId: string,
  userId: string,
  counterpartyId: string | null
): Promise<boolean> {
  if (!counterpartyId) return false;
  if (await hasSafetyCaveatAck(planId, userId)) return false;
  return isFirstMeetupPair(userId, counterpartyId);
}

export function isPlanActiveForArrivalNudge(
  status: string | null | undefined,
  scheduledAt: string | null | undefined
): boolean {
  if (status !== 'active' && status !== 'agreed') return false;
  if (!scheduledAt) return true;
  const meet = new Date(scheduledAt).getTime();
  const now = Date.now();
  const windowMs = 3 * 60 * 60 * 1000;
  return now >= meet - windowMs && now <= meet + 6 * 60 * 60 * 1000;
}
