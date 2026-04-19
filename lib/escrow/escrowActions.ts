import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbEscrowTransaction } from '@/types/database';

function mergeEscrowMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};
  return { ...base, ...patch };
}

export async function recordEscrowPaymentInitiated(
  client: SupabaseClient,
  escrowId: string,
  checkoutRef: string
): Promise<{ error: string | null }> {
  const { data, error: readErr } = await client
    .from('escrow_transactions')
    .select('metadata')
    .eq('id', escrowId)
    .single();
  if (readErr) return { error: readErr.message };
  const meta = mergeEscrowMetadata(data?.metadata as Record<string, unknown> | null, {
    payment_initiated_at: new Date().toISOString(),
    checkout_reference: checkoutRef,
  });
  const { error } = await client.from('escrow_transactions').update({ metadata: meta }).eq('id', escrowId);
  return { error: error?.message ?? null };
}

/**
 * After Paystack confirms payment, Edge Function / webhook should run this shape of update.
 * Demo / dev: call with a reference when webhook is not wired.
 */
export async function markEscrowFunded(
  client: SupabaseClient,
  escrow: Pick<DbEscrowTransaction, 'id' | 'plan_id' | 'status'>,
  paystackReference: string
): Promise<{ error: string | null }> {
  if (escrow.status !== 'pending_funding') {
    return { error: 'Escrow is not waiting for payment.' };
  }
  const { data: row } = await client.from('escrow_transactions').select('metadata').eq('id', escrow.id).single();
  const meta = mergeEscrowMetadata(row?.metadata as Record<string, unknown> | null, {
    charge_confirmed_at: new Date().toISOString(),
  });

  const { error: e1 } = await client
    .from('escrow_transactions')
    .update({ status: 'funded', paystack_reference: paystackReference, metadata: meta })
    .eq('id', escrow.id)
    .eq('status', 'pending_funding');
  if (e1) return { error: e1.message };

  const { error: e2 } = await client
    .from('plans')
    .update({ status: 'active' })
    .eq('id', escrow.plan_id)
    .in('status', ['awaiting_payment', 'agreed']);
  if (e2) return { error: e2.message };

  return { error: null };
}

/** Host or guest marks the in-person plan as done (before fund release). */
export async function confirmMeetupComplete(client: SupabaseClient, planId: string): Promise<{ error: string | null }> {
  const { error } = await client
    .from('plans')
    .update({ status: 'completed' })
    .eq('id', planId)
    .eq('status', 'active');
  return { error: error?.message ?? null };
}

export async function releaseEscrowFunds(
  client: SupabaseClient,
  escrowId: string,
  planId: string,
  planStatus: string | undefined
): Promise<{ error: string | null }> {
  if (planStatus !== 'completed') {
    return { error: 'Confirm the meetup is complete before releasing funds.' };
  }
  const { error } = await client
    .from('escrow_transactions')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('id', escrowId)
    .eq('status', 'funded');
  if (error) return { error: error.message };
  return { error: null };
}

export async function openEscrowDisputeWithTicket(
  client: SupabaseClient,
  args: {
    escrowId: string;
    planId: string;
    userId: string;
    reasonCode: string;
    reasonLabel: string;
    detail: string;
  }
): Promise<{ error: string | null }> {
  const { data: openRow } = await client
    .from('escrow_disputes')
    .select('id')
    .eq('escrow_id', args.escrowId)
    .in('status', ['open', 'under_review'])
    .maybeSingle();
  if (openRow?.id) {
    return { error: 'A dispute is already in progress for this escrow.' };
  }

  const subject = `Escrow dispute — ${args.reasonLabel}`;
  const body =
    args.detail.trim() ||
    `Plan: ${args.planId}\nEscrow: ${args.escrowId}\nReason: ${args.reasonLabel} (${args.reasonCode})`;

  const { data: ticket, error: eTicket } = await client
    .from('support_tickets')
    .insert({
      user_id: args.userId,
      subject,
      body,
      priority: 'high',
    })
    .select('id')
    .single();
  if (eTicket) return { error: eTicket.message };
  if (!ticket?.id) return { error: 'Could not create support ticket.' };

  const { error: eDisp } = await client.from('escrow_disputes').insert({
    escrow_id: args.escrowId,
    opened_by: args.userId,
    reason: args.reasonLabel,
    detail: args.detail.trim() || null,
    support_ticket_id: ticket.id as string,
    status: 'open',
  });
  if (eDisp) return { error: eDisp.message };

  const { error: eEsc } = await client
    .from('escrow_transactions')
    .update({ status: 'disputed' })
    .eq('id', args.escrowId)
    .in('status', ['pending_funding', 'funded']);
  if (eEsc) return { error: eEsc.message };

  return { error: null };
}
