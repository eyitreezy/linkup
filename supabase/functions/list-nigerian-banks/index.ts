import {
  fetchFlutterwaveNigerianBanks,
  FLUTTERWAVE_SANDBOX_ACCOUNT_HINT,
  isFlutterwaveTestSecret,
} from '../_shared/flutterwaveBanks.ts';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const flwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!flwSecret) {
    return jsonError('Bank list is temporarily unavailable. Please try again later.', 500);
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

  try {
    const banks = await fetchFlutterwaveNigerianBanks(flwSecret);

    try {
      const admin = getSupabaseAdmin();
      const rows = banks.map((bank) => ({
        bank_code: bank.bank_code,
        bank_name: bank.bank_name,
        is_active: true,
      }));
      await admin.from('nigerian_banks').upsert(rows, { onConflict: 'bank_code' });
    } catch {
      // Sync is best-effort; the client can still use the Flutterwave list.
    }

    const sandboxMode = isFlutterwaveTestSecret(flwSecret);

    return jsonResponse({
      banks,
      sandbox_mode: sandboxMode,
      sandbox_hint: sandboxMode ? FLUTTERWAVE_SANDBOX_ACCOUNT_HINT : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not load Nigerian banks.';
    return jsonError(message, 502);
  }
});
