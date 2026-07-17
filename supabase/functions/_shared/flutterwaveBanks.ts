export type FlutterwaveBankRow = {
  bank_code: string;
  bank_name: string;
};

/** Flutterwave sandbox only resolves Access Bank (044) with test account numbers. */
export const FLUTTERWAVE_SANDBOX_VERIFY_BANK_CODE = '044';

export const FLUTTERWAVE_SANDBOX_BANKS: FlutterwaveBankRow[] = [
  { bank_code: FLUTTERWAVE_SANDBOX_VERIFY_BANK_CODE, bank_name: 'Access Bank (test only)' },
];

export const FLUTTERWAVE_SANDBOX_ACCOUNT_HINT =
  'Flutterwave test mode: choose Access Bank (test only) and enter account 0690000032 (not your real account). Test accounts are 0690000031 to 0690000041 only.';

/** Official Flutterwave sandbox resolve accounts (Access Bank 044 only). */
export function isFlutterwaveSandboxTestAccount(accountNumber: string): boolean {
  if (!/^06900000\d{2}$/.test(accountNumber)) return false;
  const suffix = Number(accountNumber.slice(-2));
  return suffix >= 31 && suffix <= 41;
}

export function isFlutterwaveTestSecret(secret: string): boolean {
  return /test|sandbox/i.test(secret);
}

/**
 * Flutterwave resolve expects numeric bank codes.
 * Legacy NIBSS codes are 3 digits (044, 058); pad 1-2 digit forms.
 * Newer fintech/MFB codes stay as-is (e.g. 50211, 100004).
 */
export function normalizeFlutterwaveBankCode(bankCode: string): string {
  const digits = bankCode.replace(/\D/g, '');
  if (!digits) return bankCode.trim();
  if (digits.length <= 3) return digits.padStart(3, '0');
  return digits;
}

type FlutterwaveBanksResponse = {
  status?: string;
  message?: string;
  data?: Array<{ id?: number; code?: string | number; name?: string }>;
};

export async function fetchFlutterwaveNigerianBanks(
  flwSecret: string
): Promise<FlutterwaveBankRow[]> {
  if (isFlutterwaveTestSecret(flwSecret)) {
    return [...FLUTTERWAVE_SANDBOX_BANKS];
  }

  const res = await fetch('https://api.flutterwave.com/v3/banks/NG', {
    headers: { Authorization: `Bearer ${flwSecret}` },
  });

  const json = (await res.json()) as FlutterwaveBanksResponse;
  if (json.status !== 'success' || !Array.isArray(json.data)) {
    throw new Error(json.message?.trim() || 'Could not load Nigerian banks from Flutterwave.');
  }

  const banks = json.data
    .map((row) => ({
      bank_code: normalizeFlutterwaveBankCode(String(row.code ?? '')),
      bank_name: String(row.name ?? '').trim(),
    }))
    .filter((row) => row.bank_code.length > 0 && row.bank_name.length > 0);

  const uniqueByCode = new Map<string, FlutterwaveBankRow>();
  for (const bank of banks) {
    if (!uniqueByCode.has(bank.bank_code)) {
      uniqueByCode.set(bank.bank_code, bank);
    }
  }

  return Array.from(uniqueByCode.values()).sort((a, b) => a.bank_name.localeCompare(b.bank_name));
}

type FlutterwaveResolveResponse = {
  status?: string;
  message?: string;
  data?: { account_name?: string; account_number?: string };
};

export async function resolveFlutterwaveBankAccount(
  flwSecret: string,
  accountNumber: string,
  bankCode: string
): Promise<{ account_name: string; account_number: string }> {
  const normalizedBankCode = normalizeFlutterwaveBankCode(bankCode);
  const digitsOnlyAccount = accountNumber.replace(/\D/g, '');

  if (isFlutterwaveTestSecret(flwSecret)) {
    if (normalizedBankCode !== FLUTTERWAVE_SANDBOX_VERIFY_BANK_CODE) {
      throw new Error(FLUTTERWAVE_SANDBOX_ACCOUNT_HINT);
    }
    if (!isFlutterwaveSandboxTestAccount(digitsOnlyAccount)) {
      throw new Error(
        'Flutterwave test mode cannot verify real bank accounts. Use test account 0690000031 to 0690000041 with Access Bank (044).'
      );
    }
    // Flutterwave sandbox resolve is flaky; approved test accounts resolve locally.
    return {
      account_name: digitsOnlyAccount === '0690000036' ? 'Bode George' : 'Forrest Green',
      account_number: digitsOnlyAccount,
    };
  }

  const res = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_number: digitsOnlyAccount,
      account_bank: normalizedBankCode,
    }),
  });

  const json = (await res.json()) as FlutterwaveResolveResponse;
  if (json.status !== 'success' || !json.data?.account_name?.trim()) {
    const rawMessage = json.message?.trim() ?? '';
    if (/only 044 is allowed/i.test(rawMessage)) {
      throw new Error(FLUTTERWAVE_SANDBOX_ACCOUNT_HINT);
    }
    if (/invalid account/i.test(rawMessage)) {
      throw new Error(
        'Could not verify this account. Check that the account number belongs to the selected bank, then try again.'
      );
    }
    throw new Error(
      rawMessage ||
        'Could not verify this account. Please check that the account number belongs to the selected bank and try again.'
    );
  }

  return {
    account_name: json.data.account_name.trim(),
    account_number: json.data.account_number?.trim() || digitsOnlyAccount,
  };
}
