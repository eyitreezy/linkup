/**
 * Cron / manual sweep: mark mood plans past mood_expires_at, sync auto_expiry_at, cancel open negotiation.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: x-cron-secret matching MOOD_EXPIRY_CRON_SECRET
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('MOOD_EXPIRY_CRON_SECRET');
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

  const { data, error } = await supabase.rpc('sweep_expired_mood_plans');

  if (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const count = typeof data === 'number' ? data : 0;

  return new Response(JSON.stringify({ ok: true, expired_rows: count }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
