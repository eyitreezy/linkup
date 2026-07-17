/**
 * After Flutterwave redirect, verify tx_ref server-side and fulfill escrow (webhook fallback).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { processEscrowCharge } from '../_shared/flutterwaveEscrow.ts';
import {
  metaString,
  normalizeFlutterwaveMeta,
  parseEscrowLegFromTxRef,
  inferEscrowLegFromAmount,
  parseFlutterwaveAmountNgn,
} from '../_shared/flutterwaveMeta.ts';
import { handleCors, jsonError } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type Body = {
  escrow_id?: string;
  tx_ref?: string;
};

type FlwVerifyData = {
  id?: number | string;
  status?: string;
  amount?: unknown;
  tx_ref?: string;
  meta?: unknown;
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

  const escrowId = body.escrow_id?.trim();
  const txRef = body.tx_ref?.trim();
  if (!escrowId || !txRef) {
    return jsonError('escrow_id and tx_ref required', 400);
  }

  const { data: escrow, error: escErr } = await userClient
    .from('escrow_transactions')
    .select(
      'id, plan_id, payer_id, host_id, guest_id, status, escrow_pattern, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at'
    )
    .eq('id', escrowId)
    .maybeSingle();

  if (escErr || !escrow) {
    return jsonError('Escrow not found', 404);
  }

  const actorId = authData.user.id;
  const isParty =
    actorId === escrow.payer_id ||
    actorId === escrow.host_id ||
    actorId === escrow.guest_id;
  if (!isParty) {
    return jsonError('Forbidden', 403);
  }

  if (escrow.status === 'funded') {
    return new Response(JSON.stringify({ ok: true, status: 'funded', already: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const verified = await verifyWithRetry(txRef, flwSecret);
  if (!verified.ok) {
    return jsonError(verified.message, 409, 'payment_not_confirmed');
  }

  const flwData = verified.data;
  const meta = normalizeFlutterwaveMeta(flwData.meta);
  const metaEscrowId = metaString(meta, 'escrow_id');
  if (metaEscrowId && metaEscrowId !== escrowId) {
    return jsonError('Payment does not match this escrow', 400);
  }

  const metaUserId = metaString(meta, 'user_id');
  if (metaUserId) {
    const partyIds = [escrow.payer_id, escrow.host_id, escrow.guest_id].filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    );
    if (!partyIds.includes(metaUserId)) {
      return jsonError('Invalid payment metadata', 400);
    }
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const reference = flwData.tx_ref ?? txRef;
  const amountNgn = parseFlutterwaveAmountNgn(flwData.amount);
  let escrowLeg = metaString(meta, 'escrow_leg') ?? parseEscrowLegFromTxRef(reference);
  if (!escrowLeg && escrow.escrow_pattern === 'B') {
    escrowLeg =
      inferEscrowLegFromAmount(
        escrow.escrow_pattern as string,
        escrow.host_share_cents as number | undefined,
        escrow.guest_share_cents as number | undefined,
        amountNgn
      ) ?? undefined;
  }

  const fulfillmentMeta: Record<string, unknown> = {
    ...meta,
    linkup: 'escrow',
    escrow_id: escrowId,
    plan_id: escrow.plan_id as string,
  };
  if (escrowLeg) fulfillmentMeta.escrow_leg = escrowLeg;

  const result = await processEscrowCharge(
    admin,
    fulfillmentMeta,
    reference,
    amountNgn,
    flwData.id
  );
  const resultBody = await result.text();

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(resultBody) as Record<string, unknown>;
  } catch {
    /* non-json error body */
  }

  if (!result.ok && result.status !== 409) {
    console.error('confirm-escrow-payment fulfillment failed', result.status, resultBody);
    return jsonError(
      typeof parsed.error === 'string' ? parsed.error : 'Could not update escrow',
      result.status >= 500 ? 502 : result.status
    );
  }

  const { data: refreshed } = await admin
    .from('escrow_transactions')
    .select('status, host_funded_at, guest_funded_at')
    .eq('id', escrowId)
    .maybeSingle();

  const nextStatus = (refreshed?.status as string | undefined) ?? escrow.status;

  return new Response(
    JSON.stringify({
      ok: true,
      status: nextStatus,
      partial: parsed.partial === true,
      idempotent: parsed.idempotent === true,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
