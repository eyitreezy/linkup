/**
 * Cron / manual sweep — expire pending plan invitations and notify hosts.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: x-cron-secret matching EXPIRE_PLAN_INVITATIONS_CRON_SECRET
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('EXPIRE_PLAN_INVITATIONS_CRON_SECRET');
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

  const now = new Date().toISOString();
  const { data: expired, error } = await supabase
    .from('plan_invitations')
    .select('id, plan_id, host_id')
    .eq('status', 'pending')
    .lt('expires_at', now);

  if (error) {
    console.error('[expire-plan-invitations]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!expired?.length) {
    return new Response(JSON.stringify({ expired: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let count = 0;
  for (const invitation of expired) {
    const { error: updErr } = await supabase
      .from('plan_invitations')
      .update({ status: 'expired', slot_held: false })
      .eq('id', invitation.id)
      .eq('status', 'pending');

    if (updErr) {
      console.error('[expire-plan-invitations] update', invitation.id, updErr.message);
      continue;
    }

    const { error: notifyErr } = await supabase.rpc('create_notification', {
      p_user_id: invitation.host_id,
      p_type: 'plan_invitation_expired',
      p_title: 'Invitation expired',
      p_body: 'An invitation expired without a response. The slot is now open again.',
      p_data: {
        href: `/plan/${invitation.plan_id}/requests`,
        planId: invitation.plan_id,
      },
      p_priority: 'medium',
      p_dedupe_key: null,
    });

    if (notifyErr) {
      console.error('[expire-plan-invitations] notify', invitation.id, notifyErr.message);
    }

    count += 1;
  }

  return new Response(JSON.stringify({ expired: count }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
