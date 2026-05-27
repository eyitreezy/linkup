/**
 * Daily reconciliation stub — service role inserts a reconciliation_logs row.
 * Compare Paystack vs ledger in a follow-up iteration.
 *
 * Optional: x-reconciliation-secret header matches RECONCILIATION_CRON_SECRET.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RECONCILIATION_CRON_SECRET (optional)
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reconciliation-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const secret = Deno.env.get('RECONCILIATION_CRON_SECRET');
  if (secret) {
    const sent = req.headers.get('x-reconciliation-secret');
    if (sent !== secret) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500, headers: cors });
  }

  const { data, error } = await supabase
    .from('reconciliation_logs')
    .insert({
      status: 'stub',
      discrepancies: {
        note: 'Automated compare not implemented; stub row for ops pipeline.',
        generated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data?.id }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
