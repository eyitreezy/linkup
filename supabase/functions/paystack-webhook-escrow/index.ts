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
    .select('id, plan_id, payer_id, payee_id, amount_cents, status, currency, metadata')
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

  if (amountKobo != null && escrow.amount_cents != null && amountKobo !== escrow.amount_cents) {
    console.warn('Amount mismatch', amountKobo, escrow.amount_cents);
    return new Response('Amount mismatch', { status: 400 });
  }

  const payerId = escrow.payer_id as string;
  const payeeId = escrow.payee_id as string;

  let fundedNow = false;

  if (escrow.status === 'pending_funding') {
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
    if (cur?.status !== 'funded') {
      console.warn('Escrow not fundable', escrowId, cur?.status);
      return new Response('Escrow state conflict', { status: 409 });
    }
  }

  try {
    await notifyEscrowFunded(supabase, { reference, escrowId, planId, payerId, payeeId });
  } catch (e) {
    console.error('dispatch escrow funded', e);
    return new Response('Notify failed', { status: 500 });
  }

  const { error: idemErr } = await supabase.from('paystack_charge_processed').insert({
    reference,
    user_id: payerId,
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
