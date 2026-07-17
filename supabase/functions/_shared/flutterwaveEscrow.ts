/**
 * Escrow funding fulfillment after Flutterwave charge.completed — ported from paystack-webhook-escrow.
 */
import { dispatchUserNotification } from './dispatch.ts';
import {
  metaString,
  normalizeFlutterwaveMeta,
  parseEscrowLegFromTxRef,
  inferEscrowLegFromAmount,
  isEscrowFlutterwaveReference,
  patternBLegGrossCents,
} from './flutterwaveMeta.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function metaStringFromRaw(raw: unknown, key: string): string | undefined {
  return metaString(normalizeFlutterwaveMeta(raw), key);
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

async function fulfillEscrowFullPayment(
  supabase: SupabaseClient,
  escrowId: string,
  reference: string,
  metadataPatch: Record<string, unknown>,
  flwTransactionId?: string | number | null
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const { data: patternRow } = await supabase
    .from('escrow_transactions')
    .select('escrow_pattern')
    .eq('id', escrowId)
    .maybeSingle();
  if (patternRow?.escrow_pattern === 'B') {
    console.warn('[fulfillEscrowFullPayment] refused — split escrow requires per-leg funding', escrowId);
    return { ok: false, error: 'split_requires_leg' };
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc('fulfill_escrow_from_flutterwave', {
    p_escrow_id: escrowId,
    p_reference: reference,
    p_flw_tx_id: flwTransactionId != null ? String(flwTransactionId) : null,
    p_metadata: metadataPatch,
  });

  if (!rpcErr && rpcData && typeof rpcData === 'object') {
    const row = rpcData as { ok?: boolean; funded?: boolean; already?: boolean; error?: string };
    if (row.ok && (row.funded || row.already)) {
      return { ok: true, already: row.already };
    }
    if (row.error) {
      console.warn('[processEscrowCharge] fulfill RPC returned', row);
    }
  } else if (rpcErr) {
    console.warn('[processEscrowCharge] fulfill RPC unavailable, falling back to direct update', rpcErr.message);
  }

  const fundedAt = new Date().toISOString();
  const fullPatch: Record<string, unknown> = {
    status: 'funded',
    funded_at: fundedAt,
    paystack_reference: reference,
    payment_tx_ref: reference,
    metadata: metadataPatch,
    updated_at: fundedAt,
  };
  if (flwTransactionId != null && String(flwTransactionId).length > 0) {
    fullPatch.flutterwave_transaction_id = String(flwTransactionId);
  }

  const minimalPatch: Record<string, unknown> = {
    status: 'funded',
    paystack_reference: reference,
    metadata: metadataPatch,
    updated_at: fundedAt,
  };

  for (const patch of [fullPatch, minimalPatch]) {
    const { data: updatedRows, error: upEsc } = await supabase
      .from('escrow_transactions')
      .update(patch)
      .eq('id', escrowId)
      .eq('status', 'pending_funding')
      .select('id');

    if (!upEsc && updatedRows?.length) {
      return { ok: true };
    }
    if (upEsc) {
      console.error('[processEscrowCharge] fund update failed', {
        escrowId,
        patchKeys: Object.keys(patch),
        message: upEsc.message,
        details: upEsc.details,
        hint: upEsc.hint,
        code: upEsc.code,
      });
      if (patch === minimalPatch) {
        return { ok: false, error: upEsc.message };
      }
    }
  }

  return { ok: false, error: 'No rows updated' };
}

export async function maybeActivatePlanAfterFunding(
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

    await supabase
      .from('plans')
      .update({ status: 'active', updated_at: nowIso })
      .eq('id', planId)
      .in('status', ['negotiating', 'awaiting_payment', 'agreed']);
    return;
  }

  const { data: esc } = await supabase
    .from('escrow_transactions')
    .select('status, escrow_pattern, host_funded_at, guest_funded_at')
    .eq('plan_id', planId)
    .maybeSingle();

  if (esc?.escrow_pattern === 'B') {
    if (esc.status !== 'funded' || !esc.host_funded_at || !esc.guest_funded_at) {
      return;
    }
  } else if (esc && esc.status !== 'funded') {
    return;
  }

  await supabase
    .from('plans')
    .update({ status: 'active', updated_at: nowIso })
    .eq('id', planId)
    .in('status', ['awaiting_payment', 'agreed']);
}

export async function processEscrowCharge(
  supabase: SupabaseClient,
  metaRaw: EscrowWebhookMeta | Record<string, unknown>,
  reference: string,
  amountNgn: number | null,
  flwTransactionId?: string | number | null
): Promise<Response> {
  const meta = normalizeFlutterwaveMeta(metaRaw);
  const linkup = metaString(meta, 'linkup');
  const escrowByReference = isEscrowFlutterwaveReference(reference);
  if (linkup !== 'escrow' && !escrowByReference) {
    return new Response(JSON.stringify({ ok: true, ignored: 'not_escrow' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const escrowId = metaString(meta, 'escrow_id');
  const planIdFromMeta = metaString(meta, 'plan_id');
  if (!reference) {
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

  const escrowSelect =
    'id, plan_id, payer_id, payee_id, host_id, guest_id, amount_cents, status, currency, metadata, escrow_pattern, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at';
  let escrow: Record<string, unknown> | null = null;
  let escErr: { message?: string } | null = null;
  if (escrowId) {
    const byId = await supabase
      .from('escrow_transactions')
      .select(escrowSelect)
      .eq('id', escrowId)
      .maybeSingle();
    escrow = (byId.data as Record<string, unknown> | null) ?? null;
    escErr = byId.error as { message?: string } | null;
  }
  if (!escrow) {
    const byTxRef = await supabase
      .from('escrow_transactions')
      .select(escrowSelect)
      .eq('payment_tx_ref', reference)
      .maybeSingle();
    escrow = (byTxRef.data as Record<string, unknown> | null) ?? null;
    escErr = byTxRef.error as { message?: string } | null;
  }

  if (escErr || !escrow) {
    return new Response('Escrow not found', { status: 404 });
  }

  const resolvedEscrowId = escrowId ?? String(escrow.id);

  const planId = (planIdFromMeta ?? escrow.plan_id) as string;
  if (!planId) {
    return new Response('Plan metadata missing', { status: 400 });
  }
  if (planIdFromMeta && escrow.plan_id !== planIdFromMeta) {
    return new Response('Plan mismatch', { status: 400 });
  }

  let escrowLeg = metaString(meta, 'escrow_leg');
  const pattern = escrow.escrow_pattern as string | null;
  if (!escrowLeg && pattern === 'B') {
    escrowLeg =
      parseEscrowLegFromTxRef(reference) ??
      inferEscrowLegFromAmount(
        pattern,
        escrow.host_share_cents as number,
        escrow.guest_share_cents as number,
        amountNgn
      ) ??
      undefined;
  }

  let expectedKobo: number | null = null;
  if (pattern === 'B' && (escrowLeg === 'host' || escrowLeg === 'guest')) {
    expectedKobo = patternBLegGrossCents(
      {
        amount_cents: escrow.amount_cents as number,
        host_share_cents: escrow.host_share_cents as number | null,
        guest_share_cents: escrow.guest_share_cents as number | null,
      },
      escrowLeg
    );
  } else {
    expectedKobo = escrow.amount_cents as number;
  }

  if (amountNgn != null && expectedKobo != null) {
    const paidKobo = Math.round(amountNgn * 100);
    if (Math.abs(paidKobo - expectedKobo) > 1) {
      console.warn('Amount mismatch', amountNgn, expectedKobo, escrowLeg, paidKobo);
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

  if (pattern === 'B') {
    if (!escrowLeg || (escrowLeg !== 'host' && escrowLeg !== 'guest')) {
      console.error('[processEscrowCharge] split escrow missing leg', {
        escrowId: resolvedEscrowId,
        reference,
        amountNgn,
      });
      return new Response(JSON.stringify({ error: 'split_escrow_leg_required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const legPatch: Record<string, unknown> = {
      host_funded_at: nextHost,
      guest_funded_at: nextGuest,
      metadata: patch,
      paystack_reference: reference,
      payment_tx_ref: reference,
      updated_at: nowIso,
    };
    if (flwTransactionId != null && String(flwTransactionId).length > 0) {
      legPatch.flutterwave_transaction_id = String(flwTransactionId);
    }
    const { data: upRows, error: upEsc } = await supabase
      .from('escrow_transactions')
      .update(legPatch)
      .eq('id', resolvedEscrowId)
      .select('host_funded_at, guest_funded_at');

    if (upEsc) {
      console.error('[processEscrowCharge] split leg update failed', {
        escrowId: resolvedEscrowId,
        message: upEsc.message,
        details: upEsc.details,
        hint: upEsc.hint,
        code: upEsc.code,
      });
      return new Response(JSON.stringify({ error: 'Update failed', detail: upEsc.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const row = upRows?.[0] as { host_funded_at: string | null; guest_funded_at: string | null } | undefined;
    if (row?.host_funded_at && row?.guest_funded_at) {
      const { error: finErr } = await supabase
        .from('escrow_transactions')
        .update({ status: 'funded', funded_at: nowIso, updated_at: nowIso })
        .eq('id', resolvedEscrowId)
        .eq('status', 'pending_funding');
      if (!finErr) {
        fundedNow = true;
        notify = true;
        await maybeActivatePlanAfterFunding(supabase, planId, nowIso);
      }
    }
  } else if (pattern !== 'B' && escrow.status === 'pending_funding') {
    const nowMeta = {
      ...((escrow.metadata ?? {}) as Record<string, unknown>),
      charge_confirmed_at: new Date().toISOString(),
      payment_reference: reference,
    };

    const fulfilled = await fulfillEscrowFullPayment(
      supabase,
      resolvedEscrowId,
      reference,
      nowMeta,
      flwTransactionId
    );

    if (!fulfilled.ok) {
      return new Response(
        JSON.stringify({ error: 'Update failed', detail: fulfilled.error ?? 'unknown' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!fulfilled.already) {
      fundedNow = true;
      notify = true;
      await maybeActivatePlanAfterFunding(supabase, planId, new Date().toISOString());
    } else {
      fundedNow = true;
    }
  }

  if (!fundedNow) {
    const { data: cur } = await supabase
      .from('escrow_transactions')
      .select('status')
      .eq('id', resolvedEscrowId)
      .maybeSingle();
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
      escrowId: resolvedEscrowId,
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
