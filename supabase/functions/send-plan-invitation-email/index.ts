/**
 * Send magic-link invitation email to a non-platform user.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 *      RESEND_API_KEY, RESEND_FROM (same as notification-email), APP_URL
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import {
  buildInvitationEmailHtml,
  buildInvitationEmailText,
  INVITATION_EMAIL_SUBJECT,
  type InvitationEmailParams,
} from '../_shared/invitationEmail.ts';
import { getResendConfig, sendResendEmail } from '../_shared/resend.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const APP_URL = (Deno.env.get('APP_URL') ?? Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://linkup.app').replace(
  /\/$/,
  ''
);

function invitationExpiresAt(planScheduledAt: string | null): Date {
  const now = Date.now();
  const defaultExpiry = now + 72 * 60 * 60 * 1000;
  if (!planScheduledAt) return new Date(defaultExpiry);
  const scheduledMs = new Date(planScheduledAt).getTime();
  if (Number.isNaN(scheduledMs)) return new Date(defaultExpiry);
  const beforeMeetup = scheduledMs - 48 * 60 * 60 * 1000;
  return new Date(Math.min(defaultExpiry, beforeMeetup));
}

async function generateInvitationMagicLink(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  email: string,
  redirectTo: string
): Promise<{ magicLink: string } | { error: string }> {
  const linkTypes = ['invite', 'magiclink', 'signup'] as const;

  for (const type of linkTypes) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type,
      email,
      options: { redirectTo },
    });

    const actionLink = data?.properties?.action_link;
    if (!error && actionLink) {
      console.log('[send-plan-invitation-email] magic link', { type, emailDomain: email.split('@')[1] ?? 'unknown' });
      return { magicLink: actionLink };
    }

    const message = error?.message?.toLowerCase() ?? '';
    console.warn('[send-plan-invitation-email] generateLink failed', { type, message: error?.message });
    if (
      message.includes('already') ||
      message.includes('registered') ||
      message.includes('exists')
    ) {
      continue;
    }
  }

  return { error: 'magic_link_failed' };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 405);
  }

  if (!getResendConfig()) {
    console.error('[send-plan-invitation-email] Missing RESEND_API_KEY or RESEND_FROM');
    return jsonError('misconfigured', 500);
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    console.error('[send-plan-invitation-email]', e);
    return jsonError('misconfigured', 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('[send-plan-invitation-email] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return jsonError('misconfigured', 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('unauthorized', 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  const host = authData?.user;
  if (authErr || !host) {
    console.error('[send-plan-invitation-email] auth', authErr?.message ?? 'no user');
    return jsonError('unauthorized', 401);
  }

  const supabase = admin;

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
    return jsonError('invalid_json', 400);
  }

  const planId = body.planId?.trim();
  const inviteeEmail = body.inviteeEmail?.trim().toLowerCase();
  if (!planId || !inviteeEmail) {
    return jsonError('planId and inviteeEmail required', 400);
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(inviteeEmail)) {
    return jsonError('invalid_email', 400);
  }

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select(
      'id, creator_id, scheduled_at, is_group_plan, group_closed_at, max_guests, accepted_guest_count, is_mood_plan, is_expired, mood_expires_at, active_expires_at'
    )
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    return jsonError('plan_not_found', 404);
  }

  if (plan.creator_id !== host.id) {
    return jsonError('not_plan_host', 403);
  }

  if (!plan.is_group_plan) {
    return jsonError('invitations_group_only', 400);
  }

  if (plan.group_closed_at) {
    return jsonError('group_already_closed', 400);
  }

  const listingExpired =
    !!plan.is_expired ||
    (plan.is_mood_plan &&
      plan.mood_expires_at &&
      new Date(plan.mood_expires_at).getTime() <= Date.now()) ||
    (!plan.is_mood_plan &&
      plan.active_expires_at &&
      new Date(plan.active_expires_at).getTime() <= Date.now());

  if (listingExpired) {
    return jsonError('plan_listing_expired', 400);
  }

  const { data: slots, error: slotsErr } = await supabase.rpc('get_plan_available_slots', {
    p_plan_id: planId,
  });
  if (slotsErr || (typeof slots === 'number' && slots <= 0)) {
    return jsonError('no_slots_available', 400);
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .ilike('email', inviteeEmail)
    .maybeSingle();

  if (existingUser?.id) {
    const { data: invId, error: rpcErr } = await userClient.rpc('send_plan_invitation_to_user', {
      p_plan_id: planId,
      p_invitee_user_id: existingUser.id,
    });
    if (rpcErr) {
      console.error('[send-plan-invitation-email] in-app invite', rpcErr.message);
      return jsonError(rpcErr.message, 400);
    }
    console.log('[send-plan-invitation-email] delivery=in_app', {
      invitationId: String(invId),
      planId,
      inviteeUserId: existingUser.id,
    });
    return jsonResponse({
      invitationId: String(invId),
      delivery: 'in_app',
      emailSent: false,
    });
  }

  const expiresAt = invitationExpiresAt(plan.scheduled_at ?? null);

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
    console.error('[send-plan-invitation-email] insert', insertError.message);
    return jsonError(insertError.message, 400);
  }

  const redirectTo = `${APP_URL}/onboarding?invitation_token=${invitation.invitation_token}`;
  const linkResult = await generateInvitationMagicLink(supabase, inviteeEmail, redirectTo);

  if ('error' in linkResult) {
    await supabase.from('plan_invitations').delete().eq('id', invitation.id);
    console.error('[send-plan-invitation-email] magic link exhausted all strategies');
    return jsonError('magic_link_failed', 500);
  }

  const magicLink = linkResult.magicLink;

  const details = body.planDetails ?? {};
  const emailParams: InvitationEmailParams = {
    hostName: details.hostName ?? 'Someone',
    planName: details.name,
    meetType: details.meetType,
    planDate: details.planDate,
    shareAmount: details.shareAmount,
    magicLink,
  };

  const emailResult = await sendResendEmail({
    to: [inviteeEmail],
    subject: INVITATION_EMAIL_SUBJECT,
    text: buildInvitationEmailText(emailParams),
    html: buildInvitationEmailHtml(emailParams),
  });

  if (!emailResult.ok) {
    console.error('[send-plan-invitation-email] Resend', emailResult.status, emailResult.error);
    return jsonResponse({
      invitationId: invitation.id,
      delivery: 'email',
      emailSent: false,
      emailError: emailResult.code ?? 'email_failed',
    });
  }

  console.log('[send-plan-invitation-email] delivery=email', {
    invitationId: invitation.id,
    planId,
    resendEmailId: emailResult.id,
    toDomain: inviteeEmail.split('@')[1] ?? 'unknown',
  });

  return jsonResponse({
    invitationId: invitation.id,
    delivery: 'email',
    emailSent: true,
    resendEmailId: emailResult.id,
  });
});
