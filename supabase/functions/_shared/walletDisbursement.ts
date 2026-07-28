import { getSupabaseAdmin } from './supabaseAdmin.ts';

type PaymentAccount = {
  id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
};

export async function walletBalanceCents(
  serviceClient: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<number> {
  const { data: ledger } = await serviceClient
    .from('wallet_ledger')
    .select('type, amount, is_display_only')
    .eq('user_id', userId);

  return (ledger ?? []).reduce((n: number, row: { type: string; amount: number; is_display_only: boolean }) => {
    if (row.is_display_only) return n;
    return row.type === 'credit' ? n + row.amount : n - row.amount;
  }, 0);
}

export type DisburseTransferInput = {
  userId: string;
  amountCents: number;
  account: PaymentAccount;
  queueItemId?: string;
};

export type DisburseTransferResult =
  | { ok: true; disbursementId: string; transferRef: string }
  | { ok: false; error: string; status: number };

export async function executeWalletDisbursement(
  serviceClient: ReturnType<typeof getSupabaseAdmin>,
  flwSecret: string,
  input: DisburseTransferInput
): Promise<DisburseTransferResult> {
  const balance = await walletBalanceCents(serviceClient, input.userId);
  if (balance < input.amountCents) {
    return { ok: false, error: 'Insufficient wallet balance', status: 422 };
  }

  const transferRef = `linkup-disburse-${input.userId}-${Date.now()}`;

  const { data: request, error: reqErr } = await serviceClient
    .from('disbursement_requests')
    .insert({
      user_id: input.userId,
      amount_cents: input.amountCents,
      bank_code: input.account.bank_code,
      bank_name: input.account.bank_name,
      account_number: input.account.account_number,
      account_name: input.account.account_name,
      flutterwave_transfer_ref: transferRef,
      status: 'processing',
    })
    .select('id')
    .single();

  if (reqErr || !request) {
    return { ok: false, error: 'Failed to create disbursement request', status: 500 };
  }

  const { data: debitRow, error: debitErr } = await serviceClient
    .from('wallet_ledger')
    .insert({
      user_id: input.userId,
      type: 'debit',
      source: 'withdrawal',
      amount: input.amountCents,
      reference_id: request.id,
      is_display_only: false,
    })
    .select('id')
    .single();

  if (debitErr || !debitRow) {
    await serviceClient.from('disbursement_requests').delete().eq('id', request.id);
    return { ok: false, error: 'Failed to reserve wallet balance', status: 500 };
  }

  await serviceClient
    .from('disbursement_requests')
    .update({ wallet_ledger_debit_id: debitRow.id })
    .eq('id', request.id);

  const flwRes = await fetch('https://api.flutterwave.com/v3/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_bank: input.account.bank_code,
      account_number: input.account.account_number,
      amount: input.amountCents / 100,
      narration: 'LinkUp meetup funds withdrawal',
      currency: 'NGN',
      reference: transferRef,
      beneficiary_name: input.account.account_name,
    }),
  });

  const flwData = (await flwRes.json()) as { status?: string; message?: string };

  if (flwData.status !== 'success') {
    await serviceClient.from('wallet_ledger').delete().eq('id', debitRow.id);
    await serviceClient
      .from('disbursement_requests')
      .update({
        status: 'failed',
        failure_reason: flwData.message ?? 'transfer_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);
    return { ok: false, error: 'Transfer failed. Please try again.', status: 500 };
  }

  await serviceClient
    .from('disbursement_requests')
    .update({
      status: 'processing',
      initiated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  if (input.queueItemId) {
    await serviceClient
      .from('wallet_disbursement_queue')
      .update({
        status: 'disbursed',
        disbursement_request_id: request.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.queueItemId);
  }

  await serviceClient.rpc('create_notification', {
    p_user_id: input.userId,
    p_type: 'withdrawal_initiated',
    p_title: 'Withdrawal initiated',
    p_body: `Your withdrawal of NGN ${Math.round(input.amountCents / 100).toLocaleString('en-NG')} is on its way to your ${input.account.bank_name} account. It will arrive within a few hours.`,
    p_data: { href: '/wallet' },
    p_priority: 'high',
    p_dedupe_key: `withdrawal:${request.id}`,
  });

  return { ok: true, disbursementId: request.id, transferRef };
}
