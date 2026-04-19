/**
 * Paystack webhook — premium subscription (charge.success only).
 * Never trust client-side premium activation; only this path (or equivalent server) should set entitlements.
 *
 * Idempotency: claim `paystack_charge_processed` **before** mutating `users` so retries never double credits.
 *
 * Secrets:
 *   PAYSTACK_SECRET_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { dispatchUserNotification } from '../_shared/dispatch.ts';
import { getServerTier } from '../_shared/premiumTiers.ts';
import { parsePaystackBody, verifyPaystackSignature } from '../_shared/paystack.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

function metaString(m: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = m?.[key];
  return typeof v === 'string' ? v : undefined;
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
  if (linkup !== 'premium' && transactionType !== 'premium') {
    return new Response(JSON.stringify({ ok: true, ignored: 'not_premium' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = metaString(meta, 'user_id');
  const tierId = metaString(meta, 'tier_id');
  const reference = body.data.reference;

  if (!userId || !tierId || !reference) {
    console.warn('Premium webhook missing user_id, tier_id, or reference', meta);
    return new Response('Bad metadata', { status: 400 });
  }

  const tier = getServerTier(tierId);
  if (!tier) {
    console.warn('Unknown tier', tierId);
    return new Response('Unknown tier', { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500 });
  }

  const { error: claimErr } = await supabase.from('paystack_charge_processed').insert({
    reference,
    user_id: userId,
    kind: 'premium',
  });

  if (claimErr) {
    const dup = claimErr.code === '23505' || claimErr.message?.includes('duplicate');
    if (dup) {
      return new Response(JSON.stringify({ ok: true, idempotent: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Claim insert', claimErr.message);
    return new Response('Idempotency failed', { status: 500 });
  }

  const dedupeKey = `premium:${reference}:${userId}`;

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('boost_credits')
    .eq('id', userId)
    .maybeSingle();

  if (userErr || !userRow) {
    await supabase.from('paystack_charge_processed').delete().eq('reference', reference);
    console.warn('User not found', userId, userErr?.message);
    return new Response('User not found', { status: 404 });
  }

  const currentCredits = typeof userRow.boost_credits === 'number' ? userRow.boost_credits : 0;
  const premiumUntil = new Date();
  premiumUntil.setDate(premiumUntil.getDate() + tier.durationDays);

  const { error: upErr } = await supabase
    .from('users')
    .update({
      premium_until: premiumUntil.toISOString(),
      subscription_status: 'active',
      boost_credits: currentCredits + tier.bonusBoostCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (upErr) {
    await supabase.from('paystack_charge_processed').delete().eq('reference', reference);
    console.error('Premium user update failed', upErr.message);
    return new Response('Update failed', { status: 500 });
  }

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('user_id', userId).maybeSingle();
  const prefs = (prof?.preferences ?? {}) as Record<string, unknown>;
  const nextPrefs = { ...prefs, paystack_last_premium_reference: reference };
  await supabase.from('profiles').update({ preferences: nextPrefs }).eq('user_id', userId);

  try {
    await dispatchUserNotification(supabase, {
      userId,
      type: 'premium_activated',
      title: 'Premium activated',
      body: 'You unlocked boosts, filters, travel mode, and more. Verification is still required for paid meetups.',
      data: {
        href: '/premium/success',
        type: 'premium_activated',
        tierId: tier.id,
      },
      priority: 'medium',
      dedupeKey,
    });
  } catch (e) {
    console.error('dispatch premium', e);
    return new Response('Notify failed', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
