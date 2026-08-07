/**
 * Initialise Flutterwave payment for a new subscription.
 * Activation happens only in flutterwave-webhook after verified payment.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { resolveFlutterwaveRedirectUrl } from '../_shared/flutterwaveRedirect.ts';
import { resolveFlutterwaveCustomer } from '../_shared/flutterwaveCustomer.ts';
import { corsHeaders, handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { type BillingCycle, type PaidTier, tierPriceNgn } from '../_shared/pricing.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const FLW_INIT_URL = 'https://api.flutterwave.com/v3/payments';

type Body = {
  user_id?: string;
  tier?: PaidTier;
  billing_cycle?: BillingCycle;
  /** Web: https://your-app/subscription/callback — mobile: omit (defaults to linkup://). */
  redirect_url?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const deepLinkScheme = Deno.env.get('APP_DEEP_LINK_SCHEME') ?? 'linkup';

  if (!flwSecret || !supabaseUrl || !anonKey) {
    return jsonError('Server misconfigured', 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized', 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return jsonError('Unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const userId = body.user_id ?? authData.user.id;
  if (userId !== authData.user.id) {
    return jsonError('Forbidden', 403);
  }

  const tier = body.tier;
  const billingCycle = body.billing_cycle;
  if (!tier || !['SILVER', 'GOLD', 'PLATINUM'].includes(tier)) {
    return jsonError('Valid tier required (SILVER, GOLD, PLATINUM)', 400);
  }
  if (!billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
    return jsonError('Valid billing_cycle required (monthly, annual)', 400);
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const email = authData.user.email;
  if (!email) {
    return jsonError('User email required for billing', 400);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle();

  const amount = tierPriceNgn(tier, billingCycle);
  const txRef = `linkup_sub_${userId}_${Date.now()}`;
  const customer = resolveFlutterwaveCustomer({
    email,
    displayName: (profile?.display_name as string | null) ?? null,
    authMetadata: authData.user.user_metadata as Record<string, unknown>,
  });

  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  const redirectResolved = resolveFlutterwaveRedirectUrl(
    body.redirect_url,
    `${deepLinkScheme}://subscription/callback`
  );
  if ('error' in redirectResolved) {
    return jsonError(redirectResolved.error, 400, 'invalid_redirect_url');
  }
  const redirectUrl = redirectResolved.url;

  const flwRes = await fetch(FLW_INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency: 'NGN',
      redirect_url: redirectUrl,
      customer,
      meta: {
        user_id: userId,
        tier,
        billing_cycle: billingCycle,
        linkup: 'subscription',
      },
      customizations: {
        title: 'LinkUp Subscription',
        description: `LinkUp ${tier} — ${billingCycle}`,
      },
    }),
  });

  const flwJson = (await flwRes.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };

  if (!flwRes.ok || flwJson.status !== 'success' || !flwJson.data?.link) {
    console.error('Flutterwave init failed', flwJson);
    return jsonError(flwJson.message ?? 'Payment initialization failed', 502);
  }

  const paymentLink = String(flwJson.data.link).trim();

  if (!/^https?:\/\//i.test(paymentLink)) {
    console.error('Flutterwave returned invalid payment link', paymentLink);
    return jsonError('Payment provider returned an invalid checkout link', 502);
  }

  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'checkout_started',
    from_tier: (userRow?.subscription_tier as string | undefined) ?? 'FREE',
    to_tier: tier,
    billing_cycle: billingCycle,
    amount_ngn: amount,
    flutterwave_reference: txRef,
    metadata: { redirect_url: redirectUrl },
  });

  return jsonResponse({
    payment_link: paymentLink,
    tx_ref: txRef,
  });
});
