import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { calculateExpiry, type BillingCycle, type PaidTier, tierPriceNgn } from './pricing.ts';

export function isSubscriptionFlutterwaveReference(reference: string): boolean {
  return reference.startsWith('linkup_sub_');
}

export function parseSubscriptionUserFromTxRef(reference: string): string | null {
  const match = reference.match(/^linkup_sub_([0-9a-f-]{36})_/i);
  return match?.[1] ?? null;
}

async function resolveSubscriptionCheckout(
  supabase: SupabaseClient,
  reference: string,
  meta: Record<string, unknown>
): Promise<{ userId: string; tier: PaidTier; billingCycle: BillingCycle } | null> {
  const metaUserId = typeof meta.user_id === 'string' ? meta.user_id : undefined;
  const metaTier = typeof meta.tier === 'string' ? meta.tier : undefined;
  const metaCycle = typeof meta.billing_cycle === 'string' ? meta.billing_cycle : undefined;

  if (
    metaUserId &&
    metaTier &&
    metaCycle &&
    ['SILVER', 'GOLD', 'PLATINUM'].includes(metaTier) &&
    ['monthly', 'annual'].includes(metaCycle)
  ) {
    return {
      userId: metaUserId,
      tier: metaTier as PaidTier,
      billingCycle: metaCycle as BillingCycle,
    };
  }

  const { data: pending } = await supabase
    .from('subscription_events')
    .select('user_id, to_tier, billing_cycle')
    .eq('flutterwave_reference', reference)
    .eq('event_type', 'checkout_started')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    pending?.user_id &&
    pending.to_tier &&
    pending.billing_cycle &&
    ['SILVER', 'GOLD', 'PLATINUM'].includes(String(pending.to_tier)) &&
    ['monthly', 'annual'].includes(String(pending.billing_cycle))
  ) {
    return {
      userId: String(pending.user_id),
      tier: pending.to_tier as PaidTier,
      billingCycle: pending.billing_cycle as BillingCycle,
    };
  }

  const userId = parseSubscriptionUserFromTxRef(reference);
  if (!userId || !metaTier || !metaCycle) return null;
  if (!['SILVER', 'GOLD', 'PLATINUM'].includes(metaTier) || !['monthly', 'annual'].includes(metaCycle)) {
    return null;
  }
  return { userId, tier: metaTier as PaidTier, billingCycle: metaCycle as BillingCycle };
}

export async function fulfillSubscriptionPayment(
  supabase: SupabaseClient,
  args: {
    userId: string;
    tier: PaidTier;
    billingCycle: BillingCycle;
    amountNgn: number | null;
    reference: string;
    txId?: number | string;
    customerId?: string;
  }
): Promise<{ ok: true; already?: boolean } | { ok: false; error: string; status: number }> {
  const { userId, tier, billingCycle, reference } = args;

  const { data: existingEvent } = await supabase
    .from('subscription_events')
    .select('id')
    .eq('user_id', userId)
    .eq('flutterwave_reference', reference)
    .eq('event_type', 'payment_succeeded')
    .maybeSingle();

  if (existingEvent?.id) {
    return { ok: true, already: true };
  }

  const expectedNgn = tierPriceNgn(tier, billingCycle);
  if (args.amountNgn != null && Math.abs(args.amountNgn - expectedNgn) > 1) {
    return { ok: false, error: 'Payment amount does not match plan price', status: 400 };
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
    subscription_status: 'active',
    updated_at: new Date().toISOString(),
  };
  if (tier === 'SILVER') {
    patch.has_been_silver_subscriber = true;
  }
  if (args.customerId) {
    patch.flutterwave_customer_id = args.customerId;
  }

  const { error: upErr } = await supabase.from('users').update(patch).eq('id', userId);
  if (upErr) {
    console.error('[subscription] users update failed', upErr.message);
    return { ok: false, error: upErr.message, status: 500 };
  }

  const amountNgn = args.amountNgn ?? expectedNgn;

  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'payment_succeeded',
    from_tier: fromTier,
    to_tier: tier,
    billing_cycle: billingCycle,
    amount_ngn: amountNgn,
    flutterwave_reference: reference,
    metadata: args.txId != null ? { tx_id: args.txId } : undefined,
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

  return { ok: true };
}

export async function fulfillSubscriptionFromVerifiedPayment(
  supabase: SupabaseClient,
  args: {
    reference: string;
    meta: Record<string, unknown>;
    amountNgn: number | null;
    txId?: number | string;
    customerId?: string;
  }
): Promise<{ ok: true; already?: boolean } | { ok: false; error: string; status: number }> {
  const resolved = await resolveSubscriptionCheckout(supabase, args.reference, args.meta);
  if (!resolved) {
    return { ok: false, error: 'Could not resolve subscription checkout', status: 400 };
  }

  return fulfillSubscriptionPayment(supabase, {
    userId: resolved.userId,
    tier: resolved.tier,
    billingCycle: resolved.billingCycle,
    amountNgn: args.amountNgn,
    reference: args.reference,
    txId: args.txId,
    customerId: args.customerId,
  });
}
