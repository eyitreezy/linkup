/**
 * Daily cron — downgrade expired paid subscriptions and clear expired trials.
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const auth = req.headers.get('Authorization');
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 });
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
    .lt('silver_trial_expires_at', nowIso)
    .not('silver_trial_expires_at', 'is', null);

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
    trialsExpired += 1;
  }

  const { data: expiredGoldTrials } = await supabase
    .from('users')
    .select('id')
    .eq('subscription_tier', 'FREE')
    .lt('gold_trial_expires_at', nowIso)
    .not('gold_trial_expires_at', 'is', null);

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
    trialsExpired += 1;
  }

  return new Response(
    JSON.stringify({ ok: true, downgraded, trials_expired: trialsExpired }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
