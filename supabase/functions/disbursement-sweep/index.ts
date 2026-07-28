/**
 * Cron: escalate no-bank queue items + auto-transfer ready disbursements.
 */
import { executeWalletDisbursement } from '../_shared/walletDisbursement.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('PAYMENT_REMINDER_CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!flwSecret) {
    return new Response('misconfigured', { status: 500 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('misconfigured', { status: 500 });
  }

  await supabase.rpc('sweep_auto_disburse');

  const { data: queueItems, error: queueErr } = await supabase
    .from('wallet_disbursement_queue')
    .select('id, user_id, amount_cents')
    .eq('status', 'pending')
    .lte('disburse_after', new Date().toISOString());

  if (queueErr) {
    return new Response(JSON.stringify({ error: queueErr.message }), { status: 500 });
  }

  let processed = 0;
  let failed = 0;

  for (const item of queueItems ?? []) {
    const { data: account } = await supabase
      .from('user_payment_accounts')
      .select('id, bank_code, bank_name, account_number, account_name')
      .eq('user_id', item.user_id)
      .eq('is_default', true)
      .maybeSingle();

    if (!account) continue;

    const result = await executeWalletDisbursement(supabase, flwSecret, {
      userId: item.user_id,
      amountCents: item.amount_cents,
      account,
      queueItemId: item.id,
    });

    if (result.ok) processed += 1;
    else failed += 1;
  }

  return new Response(JSON.stringify({ ok: true, processed, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
