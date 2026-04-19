import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbPlan, DbPlanOffer } from '@/types/database';

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
 * Paid plan: create escrow (if missing), set plan to awaiting_payment, return escrow id for navigation.
 */
export async function proceedToSecurePayment(
  client: SupabaseClient,
  plan: DbPlan,
  offer: DbPlanOffer
): Promise<AgreementActionResult> {
  const amount = plan.agreed_price_cents ?? offer.amount_cents ?? plan.starting_price_cents ?? 0;
  if (amount <= 0) return { error: 'No payment amount for this plan.' };

  const { data: existing } = await client.from('escrow_transactions').select('id').eq('plan_id', plan.id).maybeSingle();
  if (existing?.id) {
    const { error: e1 } = await client.from('plans').update({ status: 'awaiting_payment' }).eq('id', plan.id);
    if (e1) return { error: e1.message };
    return { error: null, escrowId: existing.id as string };
  }

  const { data: esc, error: e2 } = await client
    .from('escrow_transactions')
    .insert({
      plan_id: plan.id,
      payer_id: offer.bidder_id,
      payee_id: plan.creator_id,
      amount_cents: amount,
      currency: plan.currency,
      status: 'pending_funding',
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
