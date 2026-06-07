/**

 * Initialize a Paystack transaction (server-side) and return authorization_url.

 *

 * Auth: user JWT (deploy with verify JWT ON).

 * Secrets: PAYSTACK_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

 */

import { getServerTier, PREMIUM_PRICE_KOBO } from '../_shared/premiumTiers.ts';

import { paystackHttpsCallbackUrl } from '../_shared/paystackCallback.ts';

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

import { corsHeaders, handleCors, jsonError, jsonResponse } from '../_shared/http.ts';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';



const PAYSTACK_INIT_URL = 'https://api.paystack.co/transaction/initialize';



type InitBody = {

  kind?: 'escrow' | 'premium';

  amount_kobo?: number;

  email?: string;

  callback_url?: string;

  escrow_id?: string;

  plan_id?: string;

  escrow_leg?: 'host' | 'guest';

  tier_id?: string;

};



Deno.serve(async (req) => {

  const cors = handleCors(req);

  if (cors) return cors;



  if (req.method !== 'POST') {

    return jsonError('Method not allowed', 405);

  }



  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');



  if (!paystackSecret) {

    return jsonError(

      'Paystack is not configured on the server. Set PAYSTACK_SECRET_KEY in Supabase secrets and redeploy.',

      500,

      'missing_paystack_secret'

    );

  }

  if (!supabaseUrl || !anonKey || !serviceKey) {

    return jsonError('Server misconfigured (Supabase env).', 500, 'missing_supabase_env');

  }



  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {

    return jsonError('Sign in required. Open checkout again after logging in.', 401, 'unauthorized');

  }



  const userClient = createClient(supabaseUrl, anonKey, {

    global: { headers: { Authorization: authHeader } },

  });

  const {

    data: { user },

    error: authErr,

  } = await userClient.auth.getUser();

  if (authErr || !user) {

    console.error('[paystack-initialize] auth', authErr?.message);

    return jsonError('Session expired. Sign out, sign in again, then retry payment.', 401, 'invalid_session');

  }



  let body: InitBody;

  try {

    body = (await req.json()) as InitBody;

  } catch {

    return jsonError('Invalid request body', 400, 'bad_json');

  }



  const kind = body.kind;

  const email = (body.email ?? user.email ?? '').trim();

  const returnUrl = body.callback_url?.trim();

  if (!kind || !email || !returnUrl) {

    return jsonError('Missing kind, email, or callback_url', 400, 'missing_fields');

  }



  const paystackCallback = paystackHttpsCallbackUrl(supabaseUrl, returnUrl);

  if (!paystackCallback) {

    return jsonError(

      'callback_url must be linkup://…, https://…, or http://localhost… (web dev). Mobile: EXPO_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL=linkup://premium/success. Web: NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL.',

      400,

      'invalid_callback'

    );

  }



  let amountKobo = 0;

  let reference = '';

  const metadata: Record<string, string> = { linkup: kind, transaction_type: kind };



  if (kind === 'premium') {

    const tierId = body.tier_id;

    const tier = getServerTier(tierId);

    if (!tier) {

      return jsonError('Unknown subscription tier', 400, 'unknown_tier');

    }

    amountKobo = PREMIUM_PRICE_KOBO[tier.id] ?? 0;

    if (amountKobo <= 0) {

      return jsonError('Invalid tier amount', 400, 'invalid_amount');

    }

    reference = `LK-PREM-${tier.id}-${Date.now()}`.slice(0, 100);

    metadata.tier_id = tier.id;

    metadata.user_id = user.id;

  } else if (kind === 'escrow') {

    const escrowId = body.escrow_id;

    const planId = body.plan_id;

    if (!escrowId || !planId) {

      return jsonError('Missing escrow_id or plan_id', 400, 'missing_escrow');

    }



    const admin = getSupabaseAdmin();

    const { data: escrow, error: escErr } = await admin

      .from('escrow_transactions')

      .select(

        'id, plan_id, payer_id, payee_id, host_id, guest_id, amount_cents, status, escrow_pattern, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at'

      )

      .eq('id', escrowId)

      .maybeSingle();



    if (escErr || !escrow) {

      return jsonError('Escrow not found', 404, 'escrow_not_found');

    }

    if (escrow.plan_id !== planId) {

      return jsonError('Plan mismatch', 400, 'plan_mismatch');

    }

    if (escrow.status !== 'pending_funding') {

      return jsonError('Escrow is not awaiting payment', 409, 'escrow_not_pending');

    }



    const pattern = escrow.escrow_pattern as string | null;

    const leg = body.escrow_leg;



    if (pattern === 'B') {

      if (leg === 'host') {

        if (user.id !== escrow.host_id) return jsonError('Forbidden', 403, 'forbidden');

        if (escrow.host_funded_at) return jsonError('Host share already funded', 409, 'already_funded');

        amountKobo = (escrow.host_share_cents as number) ?? 0;

      } else if (leg === 'guest') {

        if (user.id !== escrow.guest_id) return jsonError('Forbidden', 403, 'forbidden');

        if (escrow.guest_funded_at) return jsonError('Guest share already funded', 409, 'already_funded');

        amountKobo = (escrow.guest_share_cents as number) ?? 0;

      } else {

        return jsonError('escrow_leg required for split escrow', 400, 'missing_leg');

      }

    } else {

      if (user.id !== escrow.payer_id) {

        return jsonError('Forbidden', 403, 'forbidden');

      }

      amountKobo = escrow.amount_cents as number;

    }



    if (amountKobo <= 0) {

      return jsonError('Invalid amount', 400, 'invalid_amount');

    }



    reference = `LK-ESC-${escrowId.slice(0, 8)}-${leg ?? 'full'}-${Date.now()}`.slice(0, 100);

    metadata.escrow_id = escrowId;

    metadata.plan_id = planId;

    if (leg) metadata.escrow_leg = leg;

  } else {

    return jsonError('Invalid payment kind', 400, 'invalid_kind');

  }



  const initRes = await fetch(PAYSTACK_INIT_URL, {

    method: 'POST',

    headers: {

      Authorization: `Bearer ${paystackSecret}`,

      'Content-Type': 'application/json',

    },

    body: JSON.stringify({

      email,

      amount: amountKobo,

      currency: 'NGN',

      reference,

      callback_url: paystackCallback,

      metadata,

      channels: ['card', 'bank', 'ussd', 'bank_transfer'],

    }),

  });



  const initJson = (await initRes.json()) as {

    status?: boolean;

    message?: string;

    data?: { authorization_url?: string; reference?: string };

  };



  if (!initRes.ok || !initJson.status || !initJson.data?.authorization_url) {

    const paystackMsg = initJson.message ?? `Paystack HTTP ${initRes.status}`;

    console.error('[paystack-initialize] paystack', paystackMsg);

    return jsonError(

      paystackMsg.includes('Invalid Key')

        ? 'Invalid Paystack secret key. Use sk_test_… in Supabase secrets (Test mode).'

        : `Paystack: ${paystackMsg}`,

      502,

      'paystack_rejected'

    );

  }



  return jsonResponse({

    authorization_url: initJson.data.authorization_url,

    reference: initJson.data.reference ?? reference,

  });

});


