import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { patternBLegGrossCents } from '../_shared/flutterwaveMeta.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!flwSecret) {
    return jsonError('Server misconfigured', 500);
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  let body: {
    escrow_id?: string;
    escrow_leg?: 'host' | 'guest' | null;
    refund_account_id?: string | null;
    one_time_refund_bank_code?: string | null;
    one_time_refund_account_number?: string | null;
    one_time_refund_account_name?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.escrow_id) {
    return jsonError('escrow_id is required', 400);
  }

  const serviceClient = getSupabaseAdmin();

  const { data: escrow, error: escrowErr } = await serviceClient
    .from('escrow_transactions')
    .select(
      'id, amount_cents, payer_id, host_id, guest_id, plan_id, status, escrow_pattern, host_share_cents, guest_share_cents, host_funded_at, guest_funded_at'
    )
    .eq('id', body.escrow_id)
    .maybeSingle();

  if (escrowErr || !escrow) {
    return jsonError('Escrow not found', 404);
  }

  if (escrow.status !== 'pending_funding') {
    return jsonError('Escrow is not awaiting payment', 400);
  }

  const pattern = escrow.escrow_pattern as string | null;
  const leg = body.escrow_leg;
  let amountKobo = 0;

  if (pattern === 'B') {
    if (leg === 'host') {
      if (user.id !== escrow.host_id) return jsonError('Forbidden', 403);
      if (escrow.host_funded_at) return jsonError('Host share already funded', 409);
      amountKobo = patternBLegGrossCents(escrow, 'host');
    } else if (leg === 'guest') {
      if (user.id !== escrow.guest_id) return jsonError('Forbidden', 403);
      if (escrow.guest_funded_at) return jsonError('Guest share already funded', 409);
      amountKobo = patternBLegGrossCents(escrow, 'guest');
    } else {
      return jsonError('escrow_leg required for split escrow', 400);
    }
  } else if (pattern === 'A') {
    if (user.id !== escrow.host_id) return jsonError('Forbidden', 403);
    amountKobo = escrow.amount_cents as number;
  } else if (pattern === 'C') {
    if (user.id !== escrow.guest_id) return jsonError('Forbidden', 403);
    amountKobo = escrow.amount_cents as number;
  } else {
    if (user.id !== escrow.payer_id) return jsonError('Forbidden', 403);
    amountKobo = escrow.amount_cents as number;
  }

  if (amountKobo <= 0) {
    return jsonError('Invalid amount', 400);
  }

  const orderRef = `linkup-va-${body.escrow_id}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountKobo / 100,
      is_permanent: false,
      tx_ref: orderRef,
      narration: 'LinkUp escrow funding',
    }),
  });

  const flwData = (await flwRes.json()) as {
    status?: string;
    data?: { account_number?: string; bank_name?: string; flw_ref?: string };
    message?: string;
  };

  if (flwData.status !== 'success' || !flwData.data?.account_number) {
    console.error('[generate-virtual-account]', flwData.message ?? flwData);
    return jsonError('Could not generate virtual account. Please try again.', 500);
  }

  const bankName = flwData.data.bank_name ?? 'Virtual Bank';
  const bankCode = '035';

  const { data: session, error } = await serviceClient
    .from('virtual_account_sessions')
    .insert({
      escrow_id: body.escrow_id,
      user_id: user.id,
      account_number: flwData.data.account_number,
      bank_name: bankName,
      bank_code: bankCode,
      amount_cents: amountKobo,
      flutterwave_order_ref: orderRef,
      refund_account_id: body.refund_account_id ?? null,
      one_time_refund_bank_code: body.one_time_refund_bank_code ?? null,
      one_time_refund_account_number: body.one_time_refund_account_number ?? null,
      one_time_refund_account_name: body.one_time_refund_account_name ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !session) {
    console.error('[generate-virtual-account] insert failed', error?.message);
    return jsonError('Failed to store session.', 500);
  }

  return jsonResponse({
    session_id: session.id,
    account_number: flwData.data.account_number,
    bank_name: bankName,
    bank_code: bankCode,
    amount_cents: amountKobo,
    expires_at: expiresAt,
  });
});
