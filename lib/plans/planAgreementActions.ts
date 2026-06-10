import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { MIN_ESCROW_CENTS, MAX_ESCROW_TIER1_CENTS } from '@/lib/plans/planFinancialConfig';
import { resolveEscrowParties } from '@/lib/plans/escrowParties';
import { checkPermission } from '@/lib/subscription/checkPermission';

export type AgreementActionResult = { error: string | null; escrowId?: string };

/**
 * Free plan: both host and accepted bidder can confirm (RLS: creator + accepted bidder).
 */
export async function confirmFreePlan(
  client: SupabaseClient,
  planId: string
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('plans')
    .update({ status: 'active' })
    .eq('id', planId)
    .eq('status', 'agreed');
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Paid plan: create pattern-aware escrow, set plan to awaiting_payment.
 */
export async function proceedToSecurePayment(
  client: SupabaseClient,
  plan: DbPlan,
  offer: DbPlanOffer
): Promise<AgreementActionResult> {
  if (!plan.is_paid) {
    return { error: 'This plan is free — no escrow step.' };
  }

  const amount = plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? 0;
  if (amount <= 0) return { error: 'No payment amount for this plan.' };
  if (amount < MIN_ESCROW_CENTS) {
    return { error: `Minimum escrow is ₦${MIN_ESCROW_CENTS / 100} per policy.` };
  }

  const pattern = plan.escrow_pattern;
  if (!pattern) return { error: 'Escrow pattern missing on plan.' };

  const { data: authData } = await client.auth.getUser();
  const actorId = authData.user?.id;
  if (!actorId) return { error: 'Not signed in.' };

  if (amount > MAX_ESCROW_TIER1_CENTS) {
    const perm = await checkPermission(actorId, 'escrow.high_value');
    if (!perm.allowed) {
      return { error: 'high_value_requires_platinum' };
    }
    const { data: actorUser } = await client.from('users').select('kyc_tier').eq('id', actorId).maybeSingle();
    if (((actorUser?.kyc_tier as number) ?? 1) < 3) {
      return { error: 'high_value_requires_kyc_tier3' };
    }
    if (pattern === 'C') {
      const { data: guestUser } = await client
        .from('users')
        .select('kyc_tier')
        .eq('id', offer.bidder_id)
        .maybeSingle();
      if (((guestUser?.kyc_tier as number) ?? 1) < 3) {
        return { error: 'high_value_counterparty_requires_kyc_tier3' };
      }
    }
  }

  if (pattern === 'C') {
    const { data: hostU } = await client.from('users').select('kyc_tier').eq('id', plan.creator_id).maybeSingle();
    const { data: guestU } = await client.from('users').select('kyc_tier').eq('id', offer.bidder_id).maybeSingle();
    const ht = (hostU?.kyc_tier as number) ?? 1;
    const gt = (guestU?.kyc_tier as number) ?? 1;
    if (ht < 2 || gt < 2) {
      return { error: 'Guest-funded plans require Tier 2 verification for both you and your guest.' };
    }
  }

  const { payerId, payeeId, hostShareCents, guestShareCents } = resolveEscrowParties(
    plan,
    offer.bidder_id,
    amount
  );

  const hostId = plan.creator_id;
  const guestId = offer.bidder_id;

  /** Mood plans: both parties must fund within 1 hour of agreement (escrow creation). */
  const fundingDeadline =
    plan.is_mood_plan
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await client
    .from('escrow_transactions')
    .select('id')
    .eq('plan_id', plan.id)
    .eq('guest_id', guestId)
    .maybeSingle();
  if (existing?.id) {
    const { error: e1 } = await client.from('plans').update({ status: 'awaiting_payment' }).eq('id', plan.id);
    if (e1) return { error: e1.message };
    return { error: null, escrowId: existing.id as string };
  }

  let groupPlanIndex: number | null = null;
  if (plan.is_group_plan) {
    const { count } = await client
      .from('escrow_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan.id);
    groupPlanIndex = (count ?? 0) + 1;
  }

  const { data: esc, error: e2 } = await client
    .from('escrow_transactions')
    .insert({
      plan_id: plan.id,
      payer_id: payerId,
      payee_id: payeeId,
      host_id: hostId,
      guest_id: guestId,
      offer_id: offer.id,
      group_plan_index: groupPlanIndex,
      escrow_pattern: pattern,
      amount_cents: amount,
      host_share_cents: hostShareCents,
      guest_share_cents: guestShareCents,
      funding_deadline: fundingDeadline,
      currency: plan.currency,
      status: 'pending_funding',
      metadata: pattern === 'B' ? { legs: 'split', phase: 'awaiting_payment' } : {},
    })
    .select('id')
    .single();
  if (e2) return { error: e2.message };

  const { error: e3 } = await client.from('plans').update({ status: 'awaiting_payment' }).eq('id', plan.id);
  if (e3) return { error: e3.message };

  return { error: null, escrowId: esc.id as string };
}

/**
 * Cancel agreed / awaiting_payment plan; decline accepted offer; host may supersede pending rounds.
 */
export async function cancelAgreedPlan(
  client: SupabaseClient,
  plan: DbPlan,
  offer: DbPlanOffer,
  currentUserId: string
): Promise<{ error: string | null }> {
  if (plan.creator_id !== currentUserId && offer.bidder_id !== currentUserId) {
    return { error: 'You are not part of this agreement.' };
  }
  if (!['agreed', 'awaiting_payment'].includes(plan.status)) {
    return { error: 'This plan is not waiting for confirmation.' };
  }

  if (plan.creator_id === currentUserId) {
    const { error: e0 } = await client
      .from('plan_offers')
      .update({ status: 'superseded' })
      .eq('plan_id', plan.id)
      .in('status', ['pending', 'countered']);
    if (e0) return { error: e0.message };
  }

  const { error: e1 } = await client.from('plan_offers').update({ status: 'declined' }).eq('id', offer.id);
  if (e1) return { error: e1.message };

  const { error: e2 } = await client.from('plans').update({ status: 'cancelled' }).eq('id', plan.id);
  if (e2) return { error: e2.message };

  return { error: null };
}
