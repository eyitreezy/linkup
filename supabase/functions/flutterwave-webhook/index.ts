/**
 * Flutterwave webhook — subscriptions + escrow (sole server activation path).
 */
import { processEscrowCharge } from '../_shared/flutterwaveEscrow.ts';
import { calculateExpiry, type BillingCycle, type PaidTier } from '../_shared/pricing.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type FlwMeta = Record<string, unknown>;

function metaString(meta: FlwMeta | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' ? v : undefined;
}

function resolveEvent(body: Record<string, unknown>): string | null {
  if (typeof body.event === 'string') return body.event;
  if (typeof body.type === 'string') return body.type;
  if (typeof body['event.type'] === 'string') return body['event.type'] as string;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('FLUTTERWAVE_WEBHOOK_SECRET');
  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  const verifHash = req.headers.get('verif-hash');

  if (!webhookSecret || verifHash !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const event = resolveEvent(body);
  const data = (body.data ?? body) as Record<string, unknown>;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500 });
  }

  if (event === 'charge.completed' || event === 'charge.complete') {
    const txId = data.id;
    if (!txId || !flwSecret) {
      return new Response('Missing transaction id', { status: 400 });
    }

    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, {
      headers: { Authorization: `Bearer ${flwSecret}` },
    });
    const verifyJson = (await verifyRes.json()) as {
      status?: string;
      data?: {
        status?: string;
        amount?: number;
        tx_ref?: string;
        meta?: FlwMeta;
        customer?: { id?: number };
      };
    };

    if (verifyJson.status !== 'success' || verifyJson.data?.status !== 'successful') {
      return new Response(JSON.stringify({ ok: false, reason: 'verification_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const meta = (verifyJson.data?.meta ?? data.meta ?? {}) as FlwMeta;
    const reference = verifyJson.data?.tx_ref ?? (data.tx_ref as string | undefined) ?? String(txId);
    const amountNgn = typeof verifyJson.data?.amount === 'number' ? verifyJson.data.amount : null;
    const linkup = metaString(meta, 'linkup');

    if (linkup === 'escrow') {
      return processEscrowCharge(supabase, meta, reference, amountNgn);
    }

    const userId = metaString(meta, 'user_id');
    const tier = metaString(meta, 'tier') as PaidTier | undefined;
    const billingCycle = metaString(meta, 'billing_cycle') as BillingCycle | undefined;

    if (!userId || !tier || !billingCycle || !['SILVER', 'GOLD', 'PLATINUM'].includes(tier)) {
      return new Response('Bad metadata', { status: 400 });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('subscription_tier, subscription_expires_at, has_been_silver_subscriber')
      .eq('id', userId)
      .maybeSingle();

    const fromTier = (existing?.subscription_tier as string | undefined) ?? 'FREE';
    const hadActive =
      existing?.subscription_expires_at &&
      new Date(existing.subscription_expires_at).getTime() > Date.now() &&
      fromTier !== 'FREE';
    const expiresAt = calculateExpiry(billingCycle);

    const patch: Record<string, unknown> = {
      subscription_tier: tier,
      billing_cycle: billingCycle,
      subscription_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (tier === 'SILVER') {
      patch.has_been_silver_subscriber = true;
    }
    if (verifyJson.data?.customer?.id) {
      patch.flutterwave_customer_id = String(verifyJson.data.customer.id);
    }

    const { error: upErr } = await supabase.from('users').update(patch).eq('id', userId);
    if (upErr) {
      console.error('users update', upErr.message);
      return new Response(upErr.message, { status: 500 });
    }

    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: 'payment_succeeded',
      from_tier: fromTier,
      to_tier: tier,
      billing_cycle: billingCycle,
      amount_ngn: amountNgn,
      flutterwave_reference: reference,
      metadata: { tx_id: txId },
    });

    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: hadActive ? 'subscription_renewed' : 'subscription_created',
      from_tier: fromTier,
      to_tier: tier,
      billing_cycle: billingCycle,
      amount_ngn: amountNgn,
      flutterwave_reference: reference,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (event === 'subscription.cancelled') {
    const meta = (data.meta ?? data) as FlwMeta;
    const userId = metaString(meta, 'user_id') ?? (data.customer_email as string | undefined);
    if (!userId) {
      return new Response('Missing user', { status: 400 });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: 'subscription_cancelled',
      from_tier: userRow?.subscription_tier ?? 'FREE',
      to_tier: userRow?.subscription_tier ?? 'FREE',
      metadata: { access_until: userRow?.subscription_expires_at },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (event === 'charge.failed') {
    const meta = (data.meta ?? data) as FlwMeta;
    const userId = metaString(meta, 'user_id');
    if (userId) {
      await supabase.from('subscription_events').insert({
        user_id: userId,
        event_type: 'payment_failed',
        metadata: data,
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, ignored: event }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
