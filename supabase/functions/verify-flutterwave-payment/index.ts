/**
 * Fallback escrow settlement — verifies Flutterwave by tx_ref or transaction id and funds escrow.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { processEscrowCharge } from '../_shared/flutterwaveEscrow.ts';
import {
  metaString,
  normalizeFlutterwaveMeta,
  parseEscrowLegFromTxRef,
  inferEscrowLegFromAmount,
  parseFlutterwaveAmountNgn,
  patternBLegGrossCents,
} from '../_shared/flutterwaveMeta.ts';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type Body = { escrow_id?: string };

type FlwVerifyPayload = {
  status?: string;
  amount?: unknown;
  tx_ref?: string;
  id?: number | string;
  meta?: unknown;
};

async function fetchVerifyJson(url: string, flwSecret: string): Promise<{
  status?: string;
  data?: FlwVerifyPayload;
  message?: string;
}> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${flwSecret}` } });
  return (await res.json()) as {
    status?: string;
    data?: FlwVerifyPayload;
    message?: string;
  };
}

function isSuccessfulPayment(
  fwJson: { status?: string; data?: FlwVerifyPayload },
  expectedKobo: number
): boolean {
  if (fwJson.status !== 'success' || fwJson.data?.status !== 'successful') {
    return false;
  }
  const amountNgn = parseFlutterwaveAmountNgn(fwJson.data?.amount);
  if (amountNgn == null) return true;
  const paidKobo = Math.round(amountNgn * 100);
  return Math.abs(paidKobo - expectedKobo) <= 1;
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
  if (!escrowId) {
    return jsonError('escrow_id required', 400);
  }

  const { data: escrow, error: escErr } = await userClient
    .from('escrow_transactions')
    .select(
      'id, plan_id, payer_id, host_id, guest_id, status, amount_cents, escrow_pattern, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at, payment_tx_ref, flutterwave_transaction_id, metadata'
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

  if (escrow.status === 'funded' || escrow.status === 'active' || escrow.status === 'released') {
    return jsonResponse({ funded: true, already: true });
  }

  const meta = (escrow.metadata ?? {}) as Record<string, unknown>;
  const checkoutRef =
    typeof meta.checkout_reference === 'string' ? meta.checkout_reference : null;
  const txRef = escrow.payment_tx_ref ?? checkoutRef;

  let fwJson: { status?: string; data?: FlwVerifyPayload; message?: string } | null = null;

  if (txRef) {
    fwJson = await fetchVerifyJson(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      flwSecret
    );
  }

  if (
    (!fwJson || fwJson.status !== 'success' || fwJson.data?.status !== 'successful') &&
    escrow.flutterwave_transaction_id
  ) {
    fwJson = await fetchVerifyJson(
      `https://api.flutterwave.com/v3/transactions/${escrow.flutterwave_transaction_id}/verify`,
      flwSecret
    );
  }

  if (!fwJson || fwJson.status !== 'success' || !fwJson.data) {
    console.log('[verify] Payment not confirmed yet', {
      escrow_id: escrowId,
      fw_status: fwJson?.data?.status ?? fwJson?.message ?? 'unknown',
    });
    return jsonResponse({
      funded: false,
      fw_status: fwJson?.data?.status ?? fwJson?.message ?? 'unknown',
    });
  }

  const reference = fwJson.data.tx_ref ?? txRef;
  if (!reference) {
    return jsonResponse({ funded: false, fw_status: 'missing_tx_ref' });
  }

  const pattern = escrow.escrow_pattern as string | null;
  const flwMeta = normalizeFlutterwaveMeta(fwJson.data.meta);
  const amountNgn = parseFlutterwaveAmountNgn(fwJson.data.amount);
  let escrowLeg = metaString(flwMeta, 'escrow_leg');
  if (!escrowLeg && pattern === 'B') {
    escrowLeg =
      parseEscrowLegFromTxRef(reference) ??
      inferEscrowLegFromAmount(
        pattern,
        escrow.host_share_cents as number,
        escrow.guest_share_cents as number,
        amountNgn
      ) ??
      undefined;
  }

  let expectedKobo = escrow.amount_cents as number;
  if (pattern === 'B' && (escrowLeg === 'host' || escrowLeg === 'guest')) {
    expectedKobo = patternBLegGrossCents(escrow, escrowLeg);
  }

  if (!isSuccessfulPayment(fwJson, expectedKobo)) {
    return jsonResponse({
      funded: false,
      fw_status: fwJson.data.status ?? 'not_successful',
    });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const fulfillmentMeta: Record<string, unknown> = {
    ...flwMeta,
    linkup: 'escrow',
    escrow_id: escrowId,
    plan_id: escrow.plan_id as string,
  };
  if (escrowLeg) fulfillmentMeta.escrow_leg = escrowLeg;

  const amountNgn = parseFlutterwaveAmountNgn(fwJson.data.amount);
  const result = await processEscrowCharge(
    admin,
    fulfillmentMeta,
    reference,
    amountNgn,
    fwJson.data.id
  );

  if (!result.ok && result.status !== 409) {
    const bodyText = await result.text();
    console.error('[verify] Escrow fulfillment failed', result.status, bodyText);
    return jsonError('Could not update escrow', result.status >= 500 ? 502 : result.status);
  }

  const { data: refreshed } = await admin
    .from('escrow_transactions')
    .select('status, host_funded_at, guest_funded_at')
    .eq('id', escrowId)
    .maybeSingle();

  const funded =
    refreshed?.status === 'funded' ||
    refreshed?.status === 'active' ||
    refreshed?.status === 'released';

  console.log('[verify] Escrow funded via verify endpoint:', escrowId, { funded });
  return jsonResponse({
    funded,
    partial:
      !funded &&
      pattern === 'B' &&
      !!(refreshed?.host_funded_at || refreshed?.guest_funded_at),
    fw_status: fwJson.data.status,
  });
});
