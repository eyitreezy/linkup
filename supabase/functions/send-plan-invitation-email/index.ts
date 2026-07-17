/**
 * Send magic-link invitation email to a non-platform user.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, APP_URL
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://linkup.app';

function buildNewUserInvitationEmail(p: {
  hostName: string;
  planName?: string;
  meetType?: string;
  planDate?: string;
  shareAmount?: string;
  magicLink: string;
}): string {
  return `
    <p>Hi,</p>
    <p><strong>${p.hostName}</strong> has invited you to join
    <strong>${p.planName ?? 'a meetup'}</strong> on LinkUp,
    a verified meetup platform.</p>
    ${p.meetType ? `<p>Meet type: ${p.meetType}</p>` : ''}
    ${p.planDate ? `<p>Date: ${p.planDate}</p>` : ''}
    ${p.shareAmount ? `<p>Your share if you join: <strong>${p.shareAmount}</strong></p>` : ''}
    <p>Create your free LinkUp account to view and respond to this invitation.</p>
    <p>
      <a href="${p.magicLink}"
        style="background:#6C63FF;color:#fff;padding:12px 24px;
        border-radius:50px;text-decoration:none;font-weight:600;">
        Accept invitation
      </a>
    </p>
    <p style="font-size:12px;color:#999;">
      This link expires in 7 days. If you did not expect this email, you can ignore it.
    </p>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
  if (!resendKey || !resendFrom) {
    return new Response('misconfigured', { status: 500 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('misconfigured', { status: 500 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  const host = authData?.user;
  if (authErr || !host) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: {
    planId?: string;
    inviteeEmail?: string;
    planDetails?: {
      name?: string;
      hostName?: string;
      meetType?: string;
      planDate?: string;
      shareAmount?: string;
    };
  };

  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const planId = body.planId?.trim();
  const inviteeEmail = body.inviteeEmail?.trim().toLowerCase();
  if (!planId || !inviteeEmail) {
    return new Response(JSON.stringify({ error: 'planId and inviteeEmail required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, creator_id, scheduled_at, is_group_plan, group_closed_at, max_guests, accepted_guest_count')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    return new Response(JSON.stringify({ error: 'plan_not_found' }), { status: 404 });
  }

  if (plan.creator_id !== host.id) {
    return new Response(JSON.stringify({ error: 'not_plan_host' }), { status: 403 });
  }

  if (!plan.is_group_plan) {
    return new Response(JSON.stringify({ error: 'invitations_group_only' }), { status: 400 });
  }

  if (plan.group_closed_at) {
    return new Response(JSON.stringify({ error: 'group_already_closed' }), { status: 400 });
  }

  const { data: slots, error: slotsErr } = await supabase.rpc('get_plan_available_slots', {
    p_plan_id: planId,
  });
  if (slotsErr || (typeof slots === 'number' && slots <= 0)) {
    return new Response(JSON.stringify({ error: 'no_slots_available' }), { status: 400 });
  }

  const scheduledAt = plan.scheduled_at ? new Date(plan.scheduled_at).getTime() : null;
  const expiresAt = new Date(
    Math.min(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
      scheduledAt ? scheduledAt - 48 * 60 * 60 * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000
    )
  );

  const { data: invitation, error: insertError } = await supabase
    .from('plan_invitations')
    .insert({
      plan_id: planId,
      host_id: host.id,
      invitee_email: inviteeEmail,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, invitation_token')
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 400 });
  }

  const redirectTo = `${APP_URL}/onboarding?invitation_token=${invitation.invitation_token}`;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: inviteeEmail,
    options: { redirectTo },
  });

  if (linkError) {
    await supabase.from('plan_invitations').delete().eq('id', invitation.id);
    return new Response(JSON.stringify({ error: linkError.message }), { status: 500 });
  }

  const magicLink = linkData.properties?.action_link;
  if (!magicLink) {
    await supabase.from('plan_invitations').delete().eq('id', invitation.id);
    return new Response(JSON.stringify({ error: 'magic_link_failed' }), { status: 500 });
  }

  const details = body.planDetails ?? {};
  const html = buildNewUserInvitationEmail({
    hostName: details.hostName ?? 'Someone',
    planName: details.name,
    meetType: details.meetType,
    planDate: details.planDate,
    shareAmount: details.shareAmount,
    magicLink,
  });

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [inviteeEmail],
      subject: 'You have been invited to join a meetup on LinkUp',
      html,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error('[send-plan-invitation-email] Resend', emailRes.status, errText);
    await supabase.from('plan_invitations').delete().eq('id', invitation.id);
    return new Response(JSON.stringify({ error: 'email_failed' }), { status: 502 });
  }

  return new Response(JSON.stringify({ invitationId: invitation.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
