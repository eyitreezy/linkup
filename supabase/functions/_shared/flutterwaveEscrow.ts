/**
 * Escrow funding fulfillment after Flutterwave charge.completed — ported from paystack-webhook-escrow.
 */
import { dispatchUserNotification } from './dispatch.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function metaString(m: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = m?.[key];
  return typeof v === 'string' ? v : undefined;
}

async function notifyEscrowFunded(
  supabase: SupabaseClient,
  args: {
    reference: string;
    escrowId: string;
    planId: string;
    payerId: string;
    payeeId: string;
  }
): Promise<void> {
  const { reference, escrowId, planId, payerId, payeeId } = args;
  const title = 'Escrow funded';
  const dataBase = {
    escrowId,
    planId,
    href: `/escrow/${escrowId}`,
    type: 'escrow_funded',
  };
  await dispatchUserNotification(supabase, {
    userId: payerId,
    type: 'escrow_funded',
    title,
    body: 'Your payment is securely held. Open the plan when you’re ready for the next step.',
    data: dataBase,
    priority: 'high',
    dedupeKey: `escrow_fund:${reference}:${payerId}`,
  });
  await dispatchUserNotification(supabase, {
    userId: payeeId,
    type: 'escrow_funded',
    title,
    body: 'Escrow is funded. You’ll be notified when funds move or the meetup completes.',
    data: dataBase,
    priority: 'high',
    dedupeKey: `escrow_fund:${reference}:${payeeId}`,
  });
}

export type EscrowWebhookMeta = {
  escrow_id?: string;
  plan_id?: string;
  escrow_leg?: string;
  linkup?: string;
};

/** amount_cents in DB is kobo for NGN; Flutterwave charges in major NGN units. */
export function koboToFlwNgn(amountKobo: number): number {
  return amountKobo / 100;
}

async function maybeActivatePlanAfterFunding(
  supabase: SupabaseClient,
  planId: string,
  nowIso: string
): Promise<void> {
  const { data: plan } = await supabase
    .from('plans')
    .select('is_group_plan')
    .eq('id', planId)
    .maybeSingle();

  if (plan?.is_group_plan) {
    const { data: escrows } = await supabase
      .from('escrow_transactions')
      .select('status')
      .eq('plan_id', planId);
    const rows = escrows ?? [];
    if (rows.length === 0) return;
    const allFunded = rows.every((e) => (e as { status: string }).status === 'funded');
    if (!allFunded) return;
  }

  await supabase
    .from('plans')
    .update({ status: 'active', updated_at: nowIso })
    .eq('id', planId)
    .in('status', ['awaiting_payment', 'agreed']);
}

export async function processEscrowCharge(
  supabase: SupabaseClient,
  meta: EscrowWebhookMeta,
  reference: string,
  amountNgn: number | null
): Promise<Response> {
  const linkup = metaString(meta, 'linkup');
  if (linkup !== 'escrow') {
    return new Response(JSON.stringify({ ok: true, ignored: 'not_escrow' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const escrowId = metaString(meta, 'escrow_id');
  const planId = metaString(meta, 'plan_id');
  if (!escrowId || !planId || !reference) {
    return new Response('Bad metadata', { status: 400 });
  }

  const { data: already } = await supabase
    .from('paystack_charge_processed')
    .select('reference')
    .eq('reference', reference)
    .maybeSingle();

  if (already) {
    return new Response(JSON.stringify({ ok: true, idempotent: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: escrow, error: escErr } = await supabase
    .from('escrow_transactions')
    .select(
      'id, plan_id, payer_id, payee_id, host_id, guest_id, amount_cents, status, currency, metadata, escrow_pattern, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at'
    )
    .eq('id', escrowId)
    .maybeSingle();

  if (escErr || !escrow) {
    return new Response('Escrow not found', { status: 404 });
  }

  if (escrow.plan_id !== planId) {
    return new Response('Plan mismatch', { status: 400 });
  }

  const escrowLeg = metaString(meta, 'escrow_leg');
  const pattern = escrow.escrow_pattern as string | null;

  let expectedKobo: number | null = null;
  if (pattern === 'B' && (escrowLeg === 'host' || escrowLeg === 'guest')) {
    expectedKobo =
      escrowLeg === 'host' ? (escrow.host_share_cents as number) : (escrow.guest_share_cents as number);
  } else {
    expectedKobo = escrow.amount_cents as number;
  }

  if (amountNgn != null && expectedKobo != null) {
    const expectedNgn = koboToFlwNgn(expectedKobo);
    if (Math.abs(amountNgn - expectedNgn) > 0.01) {
      console.warn('Amount mismatch', amountNgn, expectedNgn, escrowLeg);
      return new Response('Amount mismatch', { status: 400 });
    }
  }

  const payerId = escrow.payer_id as string;
  const payeeId = escrow.payee_id as string;

  const idemUserId =
    pattern === 'B' && escrowLeg === 'host' && escrow.host_id
      ? (escrow.host_id as string)
      : pattern === 'B' && escrowLeg === 'guest' && escrow.guest_id
        ? (escrow.guest_id as string)
        : payerId;

  let fundedNow = false;
  let notify = false;

  if (pattern === 'B' && escrowLeg) {
    if (escrowLeg === 'host' && escrow.host_funded_at) {
      await supabase.from('paystack_charge_processed').insert({
        reference,
        user_id: idemUserId,
        kind: 'escrow',
      });
      return new Response(JSON.stringify({ ok: true, idempotent: true, leg: 'host' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (escrowLeg === 'guest' && escrow.guest_funded_at) {
      await supabase.from('paystack_charge_processed').insert({
        reference,
        user_id: idemUserId,
        kind: 'escrow',
      });
      return new Response(JSON.stringify({ ok: true, idempotent: true, leg: 'guest' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const nowIso = new Date().toISOString();
    const prevMeta = (escrow.metadata ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      ...prevMeta,
      charge_confirmed_at: nowIso,
      payment_reference: reference,
      last_leg: escrowLeg,
    };
    const nextHost = escrowLeg === 'host' ? nowIso : escrow.host_funded_at;
    const nextGuest = escrowLeg === 'guest' ? nowIso : escrow.guest_funded_at;

    const { data: upRows, error: upEsc } = await supabase
      .from('escrow_transactions')
      .update({
        host_funded_at: nextHost,
        guest_funded_at: nextGuest,
        metadata: patch,
        paystack_reference: reference,
        updated_at: nowIso,
      })
      .eq('id', escrowId)
      .select('host_funded_at, guest_funded_at');

    if (upEsc) {
      return new Response('Update failed', { status: 500 });
    }

    const row = upRows?.[0] as { host_funded_at: string | null; guest_funded_at: string | null } | undefined;
    if (row?.host_funded_at && row?.guest_funded_at) {
      const { error: finErr } = await supabase
        .from('escrow_transactions')
        .update({ status: 'funded', updated_at: nowIso })
        .eq('id', escrowId)
        .eq('status', 'pending_funding');
      if (!finErr) {
        fundedNow = true;
        notify = true;
        await maybeActivatePlanAfterFunding(supabase, planId, nowIso);
      }
    }
  } else if (escrow.status === 'pending_funding') {
    const nowMeta = {
      ...((escrow.metadata ?? {}) as Record<string, unknown>),
      charge_confirmed_at: new Date().toISOString(),
      payment_reference: reference,
    };

    const { data: updatedRows, error: upEsc } = await supabase
      .from('escrow_transactions')
      .update({
        status: 'funded',
        paystack_reference: reference,
        metadata: nowMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .eq('status', 'pending_funding')
      .select('id');

    if (upEsc) {
      return new Response('Update failed', { status: 500 });
    }

    if (updatedRows?.length) {
      fundedNow = true;
      notify = true;
      await maybeActivatePlanAfterFunding(supabase, planId, new Date().toISOString());
    }
  }

  if (!fundedNow) {
    const { data: cur } = await supabase.from('escrow_transactions').select('status').eq('id', escrowId).maybeSingle();
    if (cur?.status !== 'funded' && !(pattern === 'B' && escrowLeg)) {
      return new Response('Escrow state conflict', { status: 409 });
    }
    if (pattern === 'B' && escrowLeg && cur?.status !== 'funded') {
      await supabase.from('paystack_charge_processed').insert({
        reference,
        user_id: idemUserId,
        kind: 'escrow',
      });
      return new Response(JSON.stringify({ ok: true, partial: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (notify) {
    const notifyHost = (escrow.host_id as string | null) ?? payerId;
    const notifyGuest = (escrow.guest_id as string | null) ?? payeeId;
    await notifyEscrowFunded(supabase, {
      reference,
      escrowId,
      planId,
      payerId: notifyHost,
      payeeId: notifyGuest,
    });
  }

  await supabase.from('paystack_charge_processed').insert({
    reference,
    user_id: idemUserId,
    kind: 'escrow',
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
