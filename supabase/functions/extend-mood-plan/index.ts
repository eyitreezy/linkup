/**
 * Extend an active mood plan by 24 hours (Gold/Platinum, quota per tier).
 * POST { plan_id: string, user_id?: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { MOOD_PLAN_RULES, resolveEffectiveTier } from '../_shared/permissions.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type Body = { plan_id?: string; user_id?: string };

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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const planId = body.plan_id;
  if (!planId) {
    return jsonError('plan_id is required', 400);
  }

  const sessionUserId = authData.user.id;
  if (body.user_id && body.user_id !== sessionUserId) {
    return jsonError('Forbidden', 403);
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, creator_id, is_mood_plan, mood_expires_at, extension_count, status')
    .eq('id', planId)
    .maybeSingle();

  if (planErr || !plan) {
    return jsonError('Plan not found', 404);
  }

  if (plan.creator_id !== sessionUserId) {
    return jsonError('Forbidden', 403);
  }

  if (!plan.is_mood_plan) {
    return jsonResponse({ extended: false, reason: 'Not a mood plan' }, 400);
  }

  if (!plan.mood_expires_at || new Date(plan.mood_expires_at).getTime() <= Date.now()) {
    return jsonResponse({ extended: false, reason: 'Mood window has ended' }, 400);
  }

  if (!['negotiating', 'agreed'].includes(plan.status)) {
    return jsonResponse({ extended: false, reason: 'Plan status does not allow extension' }, 400);
  }

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select(
      'subscription_tier, subscription_expires_at, silver_trial_expires_at, gold_trial_expires_at, has_been_silver_subscriber'
    )
    .eq('id', sessionUserId)
    .maybeSingle();

  if (userErr || !user) {
    return jsonError('User not found', 404);
  }

  const tier = resolveEffectiveTier(user);
  const rules = MOOD_PLAN_RULES[tier];

  if (!rules.can_extend) {
    return jsonResponse({ extended: false, reason: 'Extension requires Gold or above' }, 403);
  }

  const maxExt = rules.max_extensions;
  const used = plan.extension_count ?? 0;

  if (maxExt !== -1 && used >= maxExt) {
    return jsonResponse({ extended: false, reason: 'Extension limit reached' }, 400);
  }

  const currentExpiry = new Date(plan.mood_expires_at);
  const newExpiry = new Date(currentExpiry.getTime() + 24 * 3600 * 1000);

  const { error: updErr } = await supabase
    .from('plans')
    .update({
      mood_expires_at: newExpiry.toISOString(),
      auto_expiry_at: newExpiry.toISOString(),
      extension_count: used + 1,
    })
    .eq('id', planId);

  if (updErr) {
    return jsonError(updErr.message, 500);
  }

  return jsonResponse({
    extended: true,
    new_expires_at: newExpiry.toISOString(),
    extension_count: used + 1,
  });
});
