import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { executeWalletDisbursement } from '../_shared/walletDisbursement.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized', 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  let body: {
    amount_cents?: number;
    payment_account_id?: string;
    queue_item_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.amount_cents || body.amount_cents < 100) {
    return jsonError('Minimum withdrawal is NGN 1', 400);
  }
  if (!body.payment_account_id) {
    return jsonError('payment_account_id is required', 400);
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!flwSecret) {
    return jsonError('Server misconfigured', 500);
  }

  let serviceClient;
  try {
    serviceClient = getSupabaseAdmin();
  } catch {
    return jsonError('Server misconfigured', 500);
  }

  const { data: account } = await serviceClient
    .from('user_payment_accounts')
    .select('id, bank_code, bank_name, account_number, account_name')
    .eq('id', body.payment_account_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account) return jsonError('Bank account not found', 404);

  const result = await executeWalletDisbursement(serviceClient, flwSecret, {
    userId: user.id,
    amountCents: body.amount_cents,
    account,
    queueItemId: body.queue_item_id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonResponse({
    success: true,
    disbursement_id: result.disbursementId,
    transfer_ref: result.transferRef,
    amount_cents: body.amount_cents,
  });
});
