/**
 * User-initiated subscription cancellation — retains access until subscription_expires_at.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const FLW_CANCEL_URL = 'https://api.flutterwave.com/v3/subscriptions';

type Body = { user_id?: string };

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

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* empty body ok */
  }

  const userId = body.user_id ?? authData.user.id;
  if (userId !== authData.user.id) {
    return jsonError('Forbidden', 403);
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_tier, subscription_expires_at, flutterwave_subscription_code')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return jsonError('User not found', 404);
  }

  const subCode = user.flutterwave_subscription_code as string | null;
  if (subCode) {
    const cancelRes = await fetch(`${FLW_CANCEL_URL}/${subCode}/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        'Content-Type': 'application/json',
      },
    });
    if (!cancelRes.ok) {
      const errText = await cancelRes.text();
      console.error('Flutterwave cancel failed', errText);
      return jsonError('Could not cancel with payment provider', 502);
    }
  }

  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'subscription_cancelled',
    from_tier: user.subscription_tier,
    to_tier: user.subscription_tier,
    metadata: { access_until: user.subscription_expires_at },
  });

  return jsonResponse({
    cancelled: true,
    access_until: user.subscription_expires_at,
  });
});
