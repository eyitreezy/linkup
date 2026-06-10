/**
 * Manual Gold Explorer trial — 7 days for eligible Silver subscribers.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
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

  const userId = authData.user.id;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { data: user, error } = await supabase
    .from('users')
    .select(
      'has_been_silver_subscriber, subscription_tier, subscription_expires_at, gold_trial_activated_at'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return jsonError('User not found', 404);
  }

  const paidSilver =
    user.subscription_tier === 'SILVER' &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at).getTime() > Date.now();

  if (!user.has_been_silver_subscriber || !paidSilver) {
    return jsonError('Not eligible for Gold trial', 403, 'gold_trial_ineligible');
  }

  if (user.gold_trial_activated_at) {
    return jsonError('Gold trial already used', 409, 'gold_trial_used');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { error: upErr } = await supabase
    .from('users')
    .update({
      gold_trial_activated_at: now.toISOString(),
      gold_trial_expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', userId);

  if (upErr) {
    return jsonError(upErr.message, 500);
  }

  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'trial_started',
    from_tier: 'SILVER',
    to_tier: 'GOLD',
    metadata: { trial_type: 'gold_7_day', auto_triggered: false },
  });

  return jsonResponse({
    activated: true,
    expires_at: expiresAt.toISOString(),
  });
});
