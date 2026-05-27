/**
 * Paystack webhook — escrow funding (charge.success only).
 *
 * Secrets (Dashboard → Edge Functions):
 *   PAYSTACK_SECRET_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Paystack Dashboard → Webhooks → URL: .../paystack-webhook-escrow
 */
import { dispatchUserNotification } from '../_shared/dispatch.ts';
import { parsePaystackBody, verifyPaystackSignature } from '../_shared/paystack.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

function metaString(m: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = m?.[key];
  return typeof v === 'string' ? v : undefined;
}

async function notifyEscrowFunded(
  supabase: ReturnType<typeof getSupabaseAdmin>,
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
  const dedupePayer = `escrow_fund:${reference}:${payerId}`;
  const dedupePayee = `escrow_fund:${reference}:${payeeId}`;

  await dispatchUserNotification(supabase, {
    userId: payerId,
    type: 'escrow_funded',
    title,
    body: 'Your payment is securely held. Open the plan when you’re ready for the next step.',
    data: dataBase,
    priority: 'high',
    dedupeKey: dedupePayer,
  });
  await dispatchUserNotification(supabase, {
    userId: payeeId,
    type: 'escrow_funded',
    title,
    body: 'Escrow is funded. You’ll be notified when funds move or the meetup completes.',
    data: dataBase,
    priority: 'high',
    dedupeKey: dedupePayee,
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) {
    console.error('Missing PAYSTACK_SECRET_KEY');
    return new Response('Server misconfigured', { status: 500 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('x-paystack-signature');
  if (!(await verifyPaystackSignature(rawBody, sig, secret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const body = parsePaystackBody(rawBody);
  if (!body || body.event !== 'charge.success' || !body.data) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const meta = body.data.metadata ?? {};
  const linkup = metaString(meta, 'linkup');
  const transactionType = metaString(meta, 'transaction_type');
  if (linkup !== 'escrow' && transactionType !== 'escrow') {
    return new Response(JSON.stringify({ ok: true, ignored: 'not_escrow' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const escrowId = metaString(meta, 'escrow_id');
  const planId = metaString(meta, 'plan_id');
  const reference = body.data.reference ?? metaString(meta, 'reference');
  if (!escrowId || !planId || !reference) {
    console.warn('Escrow webhook missing escrow_id, plan_id, or reference', meta);
    return new Response('Bad metadata', { status: 400 });
  }

  const amountKobo = typeof body.data.amount === 'number' ? body.data.amount : null;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500 });
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
    console.warn('Escrow not found', escrowId, escErr?.message);
    return new Response('Escrow not found', { status: 404 });
  }

  if (escrow.plan_id !== planId) {
    console.warn('plan_id mismatch', escrow.plan_id, planId);
    return new Response('Plan mismatch', { status: 400 });
  }

  const escrowLeg = metaString(meta, 'escrow_leg');
  const pattern = escrow.escrow_pattern as string | null;

  let expectedAmount: number | null = null;
  if (pattern === 'B' && (escrowLeg === 'host' || escrowLeg === 'guest')) {
    expectedAmount =
      escrowLeg === 'host' ? (escrow.host_share_cents as number) : (escrow.guest_share_cents as number);
  } else {
    expectedAmount = escrow.amount_cents as number;
  }

  if (amountKobo != null && expectedAmount != null && amountKobo !== expectedAmount) {
    console.warn('Amount mismatch', amountKobo, expectedAmount, escrowLeg);
    return new Response('Amount mismatch', { status: 400 });
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
      const { error: idemDup } = await supabase.from('paystack_charge_processed').insert({
        reference,
        user_id: idemUserId,
        kind: 'escrow',
      });
      const idemOk = !idemDup || idemDup.code === '23505' || idemDup.message?.includes('duplicate');
      if (!idemOk) console.error('idem insert (dup host leg)', idemDup.message);
      return new Response(JSON.stringify({ ok: true, idempotent: true, leg: 'host' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (escrowLeg === 'guest' && escrow.guest_funded_at) {
      const { error: idemDupG } = await supabase.from('paystack_charge_processed').insert({
        reference,
        user_id: idemUserId,
        kind: 'escrow',
      });
      const idemOkG = !idemDupG || idemDupG.code === '23505' || idemDupG.message?.includes('duplicate');
      if (!idemOkG) console.error('idem insert (dup guest leg)', idemDupG.message);
      return new Response(JSON.stringify({ ok: true, idempotent: true, leg: 'guest' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const nowIso = new Date().toISOString();
    const prevMeta = (escrow.metadata ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      ...prevMeta,
      charge_confirmed_at: nowIso,
      paystack_reference: reference,
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
      console.error('Escrow partial update failed', upEsc.message);
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
        await supabase
          .from('plans')
          .update({ status: 'active', updated_at: nowIso })
          .eq('id', planId)
          .in('status', ['awaiting_payment', 'agreed']);
      }
    }
  } else if (escrow.status === 'pending_funding') {
    const nowMeta = {
      ...((escrow.metadata ?? {}) as Record<string, unknown>),
      charge_confirmed_at: new Date().toISOString(),
      paystack_reference: reference,
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
      console.error('Escrow update failed', upEsc.message);
      return new Response('Update failed', { status: 500 });
    }

    if (updatedRows?.length) {
      fundedNow = true;
      notify = true;
      const { error: planErr } = await supabase
        .from('plans')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', planId)
        .in('status', ['awaiting_payment', 'agreed']);
      if (planErr) console.warn('Plan status update', planErr.message);
    }
  }

  if (!fundedNow) {
    const { data: cur } = await supabase.from('escrow_transactions').select('status').eq('id', escrowId).maybeSingle();
    if (cur?.status !== 'funded' && !(pattern === 'B' && escrowLeg)) {
      console.warn('Escrow not fundable', escrowId, cur?.status);
      return new Response('Escrow state conflict', { status: 409 });
    }
    if (pattern === 'B' && escrowLeg && cur?.status !== 'funded') {
      const { error: idemPartial } = await supabase.from('paystack_charge_processed').insert({
        reference,
        user_id: idemUserId,
        kind: 'escrow',
      });
      if (
        idemPartial &&
        idemPartial.code !== '23505' &&
        !idemPartial.message?.includes('duplicate')
      ) {
        console.error('idem insert (partial B)', idemPartial.message);
      }
      return new Response(JSON.stringify({ ok: true, partial: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (notify) {
    try {
      const notifyHost = (escrow.host_id as string | null) ?? payerId;
      const notifyGuest = (escrow.guest_id as string | null) ?? payeeId;
      await notifyEscrowFunded(supabase, { reference, escrowId, planId, payerId: notifyHost, payeeId: notifyGuest });
    } catch (e) {
      console.error('dispatch escrow funded', e);
      return new Response('Notify failed', { status: 500 });
    }
  }

  const { error: idemErr } = await supabase.from('paystack_charge_processed').insert({
    reference,
    user_id: idemUserId,
    kind: 'escrow',
  });

  if (idemErr) {
    const dup = idemErr.code === '23505' || idemErr.message?.includes('duplicate');
    if (!dup) {
      console.error('idem insert', idemErr.message);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
