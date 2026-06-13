/**
 * Daily sweep: notify users whose goodwill credits expire in 7 days.
 *
 * Deploy with --no-verify-jwt (cron / pg_net caller).
 * Optional: set MOOD_EXPIRY_CRON_SECRET and pass x-cron-secret.
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const secret =
    Deno.env.get('GOODWILL_EXPIRY_CRON_SECRET')?.trim() ??
    Deno.env.get('MOOD_EXPIRY_CRON_SECRET')?.trim();
  if (secret && req.headers.get('x-cron-secret')?.trim() !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('misconfigured', { status: 500 });
  }

  const { data, error } = await supabase.rpc('sweep_expiring_goodwill_credits');
  if (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, ...(data as Record<string, unknown>) }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
