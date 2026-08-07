/**
 * After Flutterwave redirect, verify tx_ref server-side and activate subscription (webhook fallback).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  fulfillSubscriptionFromVerifiedPayment,
  isSubscriptionFlutterwaveReference,
} from '../_shared/flutterwaveSubscription.ts';
import { normalizeFlutterwaveMeta, parseFlutterwaveAmountNgn } from '../_shared/flutterwaveMeta.ts';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type Body = {
  tx_ref?: string;
};

type FlwVerifyData = {
  id?: number | string;
  status?: string;
  amount?: unknown;
  tx_ref?: string;
  meta?: unknown;
  customer?: { id?: number };
};

async function verifyByReference(
  txRef: string,
  flwSecret: string
): Promise<{ ok: true; data: FlwVerifyData } | { ok: false; message: string }> {
  const verifyRes = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    { headers: { Authorization: `Bearer ${flwSecret}` } }
  );

  const verifyJson = (await verifyRes.json()) as {
    status?: string;
    message?: string;
    data?: FlwVerifyData;
  };

  if (verifyJson.status !== 'success' || verifyJson.data?.status !== 'successful') {
    return { ok: false, message: verifyJson.message ?? 'Payment not confirmed yet' };
  }

  return { ok: true, data: verifyJson.data ?? {} };
}

async function verifyWithRetry(
  txRef: string,
  flwSecret: string,
  attempts = 8
): Promise<{ ok: true; data: FlwVerifyData } | { ok: false; message: string }> {
  let lastMessage = 'Payment not confirmed yet';
  for (let i = 0; i < attempts; i++) {
    const result = await verifyByReference(txRef, flwSecret);
    if (result.ok) return result;
    lastMessage = result.message;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 800 + i * 400));
    }
  }
  return { ok: false, message: lastMessage };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

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

  const txRef = body.tx_ref?.trim();
  if (!txRef) {
    return jsonError('tx_ref required', 400);
  }

  if (!isSubscriptionFlutterwaveReference(txRef)) {
    return jsonError('Invalid subscription payment reference', 400);
  }

  const userId = authData.user.id;
  if (!txRef.includes(userId)) {
    return jsonError('Payment reference does not match signed-in user', 403);
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { data: userRow } = await admin
    .from('users')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', userId)
    .maybeSingle();

  const verified = await verifyWithRetry(txRef, flwSecret);
  if (!verified.ok) {
    return jsonError(verified.message, 409, 'payment_not_confirmed');
  }

  const flwData = verified.data;
  const meta = normalizeFlutterwaveMeta(flwData.meta);
  const reference = flwData.tx_ref ?? txRef;
  const amountNgn = parseFlutterwaveAmountNgn(flwData.amount);

  const result = await fulfillSubscriptionFromVerifiedPayment(admin, {
    reference,
    meta,
    amountNgn,
    txId: flwData.id,
    customerId: flwData.customer?.id != null ? String(flwData.customer.id) : undefined,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  const { data: refreshed } = await admin
    .from('users')
    .select('subscription_tier, subscription_expires_at, billing_cycle')
    .eq('id', userId)
    .maybeSingle();

  return jsonResponse({
    ok: true,
    activated: true,
    already: result.already === true,
    tier: refreshed?.subscription_tier ?? null,
    previous_tier: userRow?.subscription_tier ?? 'FREE',
    expires_at: refreshed?.subscription_expires_at ?? null,
    billing_cycle: refreshed?.billing_cycle ?? null,
  });
});
