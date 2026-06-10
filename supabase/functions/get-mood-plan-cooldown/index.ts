/**
 * Returns mood plan cooldown status for the authenticated user.
 * POST { user_id?: string } — user_id must match session when provided.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { MOOD_PLAN_RULES, resolveEffectiveTier } from '../_shared/permissions.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type Body = { user_id?: string };

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

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* empty body ok */
  }

  const sessionUserId = authData.user.id;
  if (body.user_id && body.user_id !== sessionUserId) {
    return jsonError('Forbidden', 403);
  }

  const userId = sessionUserId;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select(
      'subscription_tier, subscription_expires_at, silver_trial_expires_at, gold_trial_expires_at, has_been_silver_subscriber'
    )
    .eq('id', userId)
    .maybeSingle();

  if (userErr || !user) {
    return jsonError('User not found', 404);
  }

  const tier = resolveEffectiveTier(user);
  const cooldownDays = MOOD_PLAN_RULES[tier].cooldown_days;

  if (cooldownDays === 0) {
    return jsonResponse({ in_cooldown: false, effective_tier: tier });
  }

  const { data: lastPlan } = await supabase
    .from('plans')
    .select('mood_expires_at, created_at')
    .eq('creator_id', userId)
    .eq('is_mood_plan', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastPlan) {
    return jsonResponse({ in_cooldown: false, effective_tier: tier });
  }

  const anchor = lastPlan.mood_expires_at ?? lastPlan.created_at;
  if (!anchor) {
    return jsonResponse({ in_cooldown: false, effective_tier: tier });
  }

  const cooldownEnds = new Date(anchor);
  cooldownEnds.setUTCDate(cooldownEnds.getUTCDate() + cooldownDays);
  const now = Date.now();

  if (cooldownEnds.getTime() > now) {
    const hoursRemaining = Math.ceil((cooldownEnds.getTime() - now) / (3600 * 1000));
    return jsonResponse({
      in_cooldown: true,
      cooldown_ends_at: cooldownEnds.toISOString(),
      hours_remaining: hoursRemaining,
      effective_tier: tier,
    });
  }

  return jsonResponse({ in_cooldown: false, effective_tier: tier });
});
