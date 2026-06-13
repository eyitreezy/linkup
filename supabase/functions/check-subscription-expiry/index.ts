/**
 * Daily cron — downgrade expired paid subscriptions and clear expired trials.
 *
 * Deploy with --no-verify-jwt (cron / pg_net caller).
 * Auth: x-cron-secret (MOOD_EXPIRY_CRON_SECRET) when set; else Bearer service_role.
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cronSecret =
    Deno.env.get('SUBSCRIPTION_EXPIRY_CRON_SECRET')?.trim() ??
    Deno.env.get('MOOD_EXPIRY_CRON_SECRET')?.trim();

  if (cronSecret) {
    if (req.headers.get('x-cron-secret')?.trim() !== cronSecret) {
      return new Response('Forbidden', { status: 403 });
    }
  } else {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const auth = req.headers.get('Authorization');
    if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500 });
  }

  const nowIso = new Date().toISOString();
  let downgraded = 0;
  let trialsExpired = 0;

  const { data: expiredPaid } = await supabase
    .from('users')
    .select('id, subscription_tier, billing_cycle')
    .neq('subscription_tier', 'FREE')
    .lt('subscription_expires_at', nowIso);

  for (const row of expiredPaid ?? []) {
    await supabase
      .from('users')
      .update({
        subscription_tier: 'FREE',
        billing_cycle: null,
        updated_at: nowIso,
      })
      .eq('id', row.id);

    await supabase.from('subscription_events').insert({
      user_id: row.id,
      event_type: 'subscription_expired',
      from_tier: row.subscription_tier,
      to_tier: 'FREE',
      billing_cycle: row.billing_cycle,
    });
    downgraded += 1;
  }

  const { data: expiredSilverTrials } = await supabase
    .from('users')
    .select('id')
    .eq('subscription_tier', 'FREE')
    .not('silver_trial_activated_at', 'is', null)
    .not('silver_trial_expires_at', 'is', null)
    .lt('silver_trial_expires_at', nowIso);

  for (const row of expiredSilverTrials ?? []) {
    await supabase
      .from('users')
      .update({ silver_trial_expires_at: null, updated_at: nowIso })
      .eq('id', row.id);

    await supabase.from('subscription_events').insert({
      user_id: row.id,
      event_type: 'trial_expired',
      from_tier: 'SILVER',
      to_tier: 'FREE',
      metadata: { trial_type: 'silver_7_day' },
    });

    await supabase.from('notifications').insert({
      user_id: row.id,
      type: 'trial_expired',
      title: 'Your Silver trial has ended',
      body: 'Subscribe to Silver to keep your features active.',
      data: { href: '/subscription', trialType: 'silver' },
    });
    trialsExpired += 1;
  }

  const { data: expiredGoldTrials } = await supabase
    .from('users')
    .select('id')
    .not('gold_trial_activated_at', 'is', null)
    .not('gold_trial_expires_at', 'is', null)
    .lt('gold_trial_expires_at', nowIso);

  for (const row of expiredGoldTrials ?? []) {
    await supabase
      .from('users')
      .update({ gold_trial_expires_at: null, updated_at: nowIso })
      .eq('id', row.id);

    await supabase.from('subscription_events').insert({
      user_id: row.id,
      event_type: 'trial_expired',
      from_tier: 'GOLD',
      to_tier: 'FREE',
      metadata: { trial_type: 'gold_7_day' },
    });

    await supabase.from('notifications').insert({
      user_id: row.id,
      type: 'trial_expired',
      title: 'Your Gold trial has ended',
      body: 'Subscribe to Gold to keep your features active.',
      data: { href: '/subscription', trialType: 'gold' },
    });
    trialsExpired += 1;
  }

  return new Response(
    JSON.stringify({ ok: true, downgraded, trials_expired: trialsExpired }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
