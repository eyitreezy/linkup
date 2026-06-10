/**
 * Cron / manual sweep — auto-release escrow 24h after plan completion.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: x-cron-secret matching PAYMENT_REMINDER_CRON_SECRET
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('PAYMENT_REMINDER_CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('misconfigured', { status: 500 });
  }

  const { data, error } = await supabase.rpc('sweep_completed_plan_auto_release');

  if (error) {
    console.error('[auto-release-sweep]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const released_count = typeof data === 'number' ? data : 0;

  return new Response(JSON.stringify({ ok: true, released_count }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
