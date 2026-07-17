import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return jsonError('Forbidden', 403);
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!flwSecret) {
    return jsonError('Server misconfigured', 500);
  }

  let body: { escrow_id?: string; reason?: string };
  try {
    body = (await req.json()) as { escrow_id?: string; reason?: string };
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
      `
      *,
      refund_account:user_payment_accounts(bank_code, bank_name, account_number, account_name)
    `
    )
    .eq('id', body.escrow_id)
    .maybeSingle();

  if (escrowErr || !escrow) {
    return jsonError('Escrow not found', 404);
  }

  if (escrow.payment_method !== 'bank_transfer') {
    return jsonError('Not a bank transfer escrow', 400);
  }

  const { data: vaSession } = await serviceClient
    .from('virtual_account_sessions')
    .select('one_time_refund_bank_code, one_time_refund_account_number, one_time_refund_account_name')
    .eq('escrow_id', body.escrow_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const refundAccount = escrow.refund_account as {
    bank_code?: string;
    bank_name?: string;
    account_number?: string;
    account_name?: string;
  } | null;

  const refundBankCode = refundAccount?.bank_code ?? vaSession?.one_time_refund_bank_code;
  const refundAccountNumber =
    refundAccount?.account_number ?? vaSession?.one_time_refund_account_number;
  const refundAccountName = refundAccount?.account_name ?? vaSession?.one_time_refund_account_name;

  if (!refundBankCode || !refundAccountNumber) {
    return jsonError('No refund account details available', 422);
  }

  const transferRef = `linkup-refund-${body.escrow_id}-${Date.now()}`;

  const flwRes = await fetch('https://api.flutterwave.com/v3/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_bank: refundBankCode,
      account_number: refundAccountNumber,
      amount: escrow.amount_cents / 100,
      narration: `LinkUp refund: ${body.reason ?? 'plan cancelled'}`,
      currency: 'NGN',
      reference: transferRef,
      beneficiary_name: refundAccountName,
    }),
  });

  const flwData = (await flwRes.json()) as { status?: string; message?: string };

  if (flwData.status !== 'success') {
    console.error('[initiate-refund]', flwData);
    return jsonError('Refund transfer failed', 500);
  }

  await serviceClient
    .from('escrow_transactions')
    .update({ refund_status: 'initiated' })
    .eq('id', body.escrow_id);

  await serviceClient.rpc('create_notification', {
    p_user_id: escrow.payer_id,
    p_type: 'refund_initiated',
    p_title: 'Refund initiated',
    p_body: `Your refund has been initiated to ${refundAccount?.bank_name ?? 'your bank'}. It will arrive within 3 business days.`,
    p_data: { href: '/wallet' },
    p_priority: 'medium',
    p_dedupe_key: null,
  });

  return jsonResponse({ success: true, transfer_ref: transferRef });
});
