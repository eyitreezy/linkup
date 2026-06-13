/**
 * Weekly sweep: purge dispute evidence past retention + remove storage objects.
 *
 * Deploy with --no-verify-jwt (cron / pg_net caller).
 * Optional: set EVIDENCE_PURGE_CRON_SECRET (or MOOD_EXPIRY_CRON_SECRET) and pass x-cron-secret.
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const secret =
    Deno.env.get('EVIDENCE_PURGE_CRON_SECRET')?.trim() ??
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

  const { data: dueRows, error: listErr } = await supabase.rpc('list_dispute_evidence_due_for_purge');
  if (listErr) {
    console.error(listErr.message);
    return new Response(JSON.stringify({ error: listErr.message }), { status: 500 });
  }

  const paths = (dueRows ?? [])
    .map((r: { file_path?: string | null }) => r.file_path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);

  const { data: purgedCount, error: purgeErr } = await supabase.rpc('purge_dispute_evidence_due');
  if (purgeErr) {
    console.error(purgeErr.message);
    return new Response(JSON.stringify({ error: purgeErr.message }), { status: 500 });
  }

  let storageRemoved = 0;
  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage.from('private_disputes').remove(paths);
    if (storageErr) {
      console.error('storage remove:', storageErr.message);
    } else {
      storageRemoved = paths.length;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      purged_rows: typeof purgedCount === 'number' ? purgedCount : 0,
      storage_removed: storageRemoved,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
