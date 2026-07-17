import { supabase } from '@/lib/supabase';
import type { DbNigerianBank, DbUserPaymentAccount } from '@/types/database';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type NigerianBanksLoadResult = {
  banks: DbNigerianBank[];
  sandboxMode: boolean;
  sandboxHint: string | null;
};

async function readFunctionError(error: FunctionsHttpError): Promise<string | null> {
  try {
    const body = (await error.context.json()) as { error?: string };
    return body?.error?.trim() || null;
  } catch {
    return null;
  }
}

export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string,
  bankName?: string
): Promise<{ account_name: string; account_number: string; bank_code: string }> {
  const { data, error } = await supabase.functions.invoke('verify-bank-account', {
    body: { account_number: accountNumber, bank_code: bankCode, bank_name: bankName ?? null },
  });

  if (data?.error) {
    throw new Error(String(data.error));
  }

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const message = await readFunctionError(error);
      if (message) throw new Error(message);
    }
    throw new Error(
      'Could not verify this account. Please check that the account number belongs to the selected bank and try again.'
    );
  }

  if (!data?.account_name) {
    throw new Error(
      'Could not verify this account. Please check that the account number belongs to the selected bank and try again.'
    );
  }

  return data as { account_name: string; account_number: string; bank_code: string };
}

export async function generateVirtualAccount(params: {
  escrowId: string;
  escrowLeg?: 'host' | 'guest';
  refundAccountId?: string;
  oneTimeRefundBankCode?: string;
  oneTimeRefundAccountNumber?: string;
  oneTimeRefundAccountName?: string;
}) {
  const { data, error } = await supabase.functions.invoke('generate-virtual-account', {
    body: {
      escrow_id: params.escrowId,
      escrow_leg: params.escrowLeg ?? null,
      refund_account_id: params.refundAccountId ?? null,
      one_time_refund_bank_code: params.oneTimeRefundBankCode ?? null,
      one_time_refund_account_number: params.oneTimeRefundAccountNumber ?? null,
      one_time_refund_account_name: params.oneTimeRefundAccountName ?? null,
    },
  });
  if (error) {
    throw new Error('Could not generate virtual account. Please try again.');
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data as {
    session_id: string;
    account_number: string;
    bank_name: string;
    bank_code: string;
    amount_cents: number;
    expires_at: string;
  };
}

export async function fetchSavedPaymentAccount(userId: string) {
  const { data } = await supabase
    .from('user_payment_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  return data;
}

export async function savePaymentAccount(params: {
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  await supabase
    .from('user_payment_accounts')
    .update({ is_default: false })
    .eq('user_id', params.userId);

  const { data, error } = await supabase
    .from('user_payment_accounts')
    .upsert(
      {
        user_id: params.userId,
        bank_code: params.bankCode,
        bank_name: params.bankName,
        account_number: params.accountNumber,
        account_name: params.accountName,
        is_default: true,
        ndpr_consent_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,account_number,bank_code' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchNigerianBanks(): Promise<NigerianBanksLoadResult> {
  const { data, error } = await supabase.functions.invoke('list-nigerian-banks', { body: {} });

  if (!error && Array.isArray(data?.banks) && data.banks.length > 0) {
    return {
      banks: dedupeNigerianBanks(data.banks as DbNigerianBank[]),
      sandboxMode: !!data.sandbox_mode,
      sandboxHint: typeof data.sandbox_hint === 'string' ? data.sandbox_hint : null,
    };
  }

  const { data: dbBanks } = await supabase
    .from('nigerian_banks')
    .select('bank_code, bank_name')
    .eq('is_active', true)
    .order('bank_name');

  return {
    banks: dedupeNigerianBanks((dbBanks ?? []) as DbNigerianBank[]),
    sandboxMode: false,
    sandboxHint: null,
  };
}

function dedupeNigerianBanks(banks: DbNigerianBank[]): DbNigerianBank[] {
  const uniqueByCode = new Map<string, DbNigerianBank>();
  for (const bank of banks) {
    if (!uniqueByCode.has(bank.bank_code)) {
      uniqueByCode.set(bank.bank_code, bank);
    }
  }
  return Array.from(uniqueByCode.values());
}

export async function deletePaymentAccount(accountId: string) {
  const { error } = await supabase
    .from('user_payment_accounts')
    .delete()
    .eq('id', accountId);
  if (error) throw error;
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
