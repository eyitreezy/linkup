import { resolveFlutterwaveBankAccount, normalizeFlutterwaveBankCode } from '../_shared/flutterwaveBanks.ts';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
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
    return jsonError('Account verification is temporarily unavailable. Please try again later.', 500);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  let body: { account_number?: string; bank_code?: string; bank_name?: string };
  try {
    body = (await req.json()) as { account_number?: string; bank_code?: string; bank_name?: string };
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const accountNumber = body.account_number?.replace(/\D/g, '').trim();
  const bankCode = normalizeFlutterwaveBankCode(body.bank_code ?? '');
  if (!accountNumber || !bankCode) {
    return jsonError('account_number and bank_code are required', 400);
  }
  if (accountNumber.length !== 10) {
    return jsonError('Enter a valid 10-digit Nigerian account number.', 400);
  }

  try {
    const resolved = await resolveFlutterwaveBankAccount(flwSecret, accountNumber, bankCode);

    try {
      const admin = getSupabaseAdmin();
      await admin.from('nigerian_banks').upsert(
        {
          bank_code: bankCode,
          bank_name: body.bank_name?.trim() || bankCode,
          is_active: true,
        },
        { onConflict: 'bank_code' }
      );
    } catch {
      // Best-effort sync for refund-account foreign keys.
    }

    return jsonResponse({
      account_name: resolved.account_name,
      account_number: resolved.account_number,
      bank_code: bankCode,
    });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : 'Could not verify this account. Please check that the account number belongs to the selected bank and try again.';
    return jsonError(message, 422);
  }
});
