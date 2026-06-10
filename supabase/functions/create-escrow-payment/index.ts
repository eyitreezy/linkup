/**
 * Initialise Flutterwave payment for escrow funding.
 * Fulfillment happens only in flutterwave-webhook after verified payment.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { koboToFlwNgn } from '../_shared/flutterwaveEscrow.ts';
import { resolveFlutterwaveRedirectUrl } from '../_shared/flutterwaveRedirect.ts';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const FLW_INIT_URL = 'https://api.flutterwave.com/v3/payments';

type Body = {
  escrow_id?: string;
  plan_id?: string;
  escrow_leg?: 'host' | 'guest';
  /** Web: https://your-app/escrow/[id]?payment=return — mobile: omit (defaults to linkup://). */
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

  const escrowId = body.escrow_id;
  const planId = body.plan_id;
  if (!escrowId || !planId) {
    return jsonError('escrow_id and plan_id required', 400);
  }

  const email = authData.user.email;
  if (!email) {
    return jsonError('User email required for payment', 400);
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { data: escrow, error: escErr } = await supabase
    .from('escrow_transactions')
    .select(
      'id, plan_id, payer_id, host_id, guest_id, amount_cents, status, escrow_pattern, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at'
    )
    .eq('id', escrowId)
    .maybeSingle();

  if (escErr || !escrow) {
    return jsonError('Escrow not found', 404);
  }
  if (escrow.plan_id !== planId) {
    return jsonError('Plan mismatch', 400);
  }
  if (escrow.status !== 'pending_funding') {
    return jsonError('Escrow is not awaiting payment', 409);
  }

  const pattern = escrow.escrow_pattern as string | null;
  const leg = body.escrow_leg;
  let amountKobo = 0;

  if (pattern === 'B') {
    if (leg === 'host') {
      if (authData.user.id !== escrow.host_id) return jsonError('Forbidden', 403);
      if (escrow.host_funded_at) return jsonError('Host share already funded', 409);
      amountKobo = (escrow.host_share_cents as number) ?? 0;
    } else if (leg === 'guest') {
      if (authData.user.id !== escrow.guest_id) return jsonError('Forbidden', 403);
      if (escrow.guest_funded_at) return jsonError('Guest share already funded', 409);
      amountKobo = (escrow.guest_share_cents as number) ?? 0;
    } else {
      return jsonError('escrow_leg required for split escrow', 400);
    }
  } else {
    if (authData.user.id !== escrow.payer_id) {
      return jsonError('Forbidden', 403);
    }
    amountKobo = escrow.amount_cents as number;
  }

  if (amountKobo <= 0) {
    return jsonError('Invalid amount', 400);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  const amountNgn = koboToFlwNgn(amountKobo);
  const txRef = `linkup_esc_${escrowId.slice(0, 8)}_${leg ?? 'full'}_${Date.now()}`;
  const redirectResolved = resolveFlutterwaveRedirectUrl(
    body.redirect_url,
    `${deepLinkScheme}://escrow/${escrowId}`
  );
  if ('error' in redirectResolved) {
    return jsonError(redirectResolved.error, 400, 'invalid_redirect_url');
  }
  const redirectUrl = redirectResolved.url;

  const meta: Record<string, string> = {
    linkup: 'escrow',
    escrow_id: escrowId,
    plan_id: planId,
    user_id: authData.user.id,
  };
  if (leg) meta.escrow_leg = leg;

  const flwRes = await fetch(FLW_INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: amountNgn,
      currency: 'NGN',
      redirect_url: redirectUrl,
      customer: {
        email,
        name: (profile?.display_name as string | null) ?? email.split('@')[0],
      },
      meta,
      customizations: {
        title: 'LinkUp Escrow',
        description: 'Secure meetup escrow payment',
      },
    }),
  });

  const flwJson = (await flwRes.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };

  if (!flwRes.ok || flwJson.status !== 'success' || !flwJson.data?.link) {
    console.error('Flutterwave escrow init failed', flwJson);
    return jsonError(flwJson.message ?? 'Payment initialization failed', 502);
  }

  return jsonResponse({
    payment_link: flwJson.data.link,
    tx_ref: txRef,
  });
});
