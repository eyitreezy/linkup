/**
 * Supabase Edge Function — send a generic email when a row is inserted into `public.notifications`.
 *
 * Wire-up: Dashboard → Database → Webhooks → Create → Table `notifications`, Event INSERT,
 * HTTP POST to this function URL, add header e.g. `x-linkup-webhook-secret: <same as secret below>`.
 *
 * Env (Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY, RESEND_FROM (e.g. LinkUp <onboarding@yourdomain.com>)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NOTIFICATION_EMAIL_WEBHOOK_SECRET (must match webhook custom header)
 *
 * Email copy is derived only from `notification.type` — never from title/body/data (avoids amounts & KYC leaks).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { parseNotificationWebhookPayload } from '../_shared/webhookRecord.ts';

function genericEmailForType(type: string | undefined): { subject: string; text: string } {
  const t = type ?? 'update';
  if (t.startsWith('escrow_') || t === 'completion_release' || t === 'cancel_chargeback') {
    return {
      subject: 'LinkUp — escrow update',
      text:
        'Something changed with a payment or escrow you’re involved in. Open the LinkUp app to see details — we never include sensitive payment information in email.',
    };
  }
  if (t === 'dispute_opened') {
    return {
      subject: 'LinkUp — dispute update',
      text: 'A dispute needs your attention. Open LinkUp for the latest — funds may be on hold until this is resolved.',
    };
  }
  if (t.startsWith('kyc_') || t === 'account_restriction') {
    return {
      subject: 'LinkUp — account or verification update',
      text: 'There’s an update about your account or verification. Open the LinkUp app to review — we don’t send verification outcomes by email.',
    };
  }
  if (t.startsWith('offer_') || t === 'mutual_agreement') {
    return {
      subject: 'LinkUp — plan activity',
      text: 'You have new activity on a plan (for example an offer or agreement). Open LinkUp to respond.',
    };
  }
  if (t === 'premium_activated') {
    return {
      subject: 'LinkUp — Premium',
      text: 'Your Premium subscription is active. Open LinkUp to explore boosts and filters — we never send payment details by email.',
    };
  }
  if (t === 'message') {
    return {
      subject: 'LinkUp — new message',
      text: 'You have a new message. Open LinkUp to read it.',
    };
  }
  if (t === 'plan_reminder') {
    return {
      subject: 'LinkUp — reminder',
      text: 'A quick reminder about something you’re planning on LinkUp. Open the app for details.',
    };
  }
  if (t === 'payment_reminder') {
    return {
      subject: 'LinkUp — fund your meetup',
      text: 'Your plan still needs secure escrow payment. Open LinkUp to complete Paystack checkout before the funding window ends.',
    };
  }
  if (t === 'report_submitted') {
    return {
      subject: 'LinkUp — report received',
      text: 'We received a safety report linked to your account or content. Open LinkUp or check support if you need help.',
    };
  }
  if (t === 'meet_type_submitted') {
    return {
      subject: 'LinkUp — meet type pending approval',
      text: 'A member submitted a new meet type for review. Open the Admin panel in LinkUp to approve or reject it.',
    };
  }
  if (t === 'meet_type_approved') {
    return {
      subject: 'LinkUp — meet type approved',
      text: 'Your custom meet type was approved and is ready to use when you create a plan. Open LinkUp to get started.',
    };
  }
  if (t === 'meet_type_rejected') {
    return {
      subject: 'LinkUp — meet type not approved',
      text: 'Your custom meet type was not approved. Open LinkUp to create a new type or pick from the catalog.',
    };
  }
  return {
    subject: 'LinkUp — notification',
    text: 'You have a new notification in LinkUp. Open the app to see more.',
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('NOTIFICATION_EMAIL_WEBHOOK_SECRET');
  const sent = req.headers.get('x-linkup-webhook-secret');
  if (!secret || sent !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!resendKey || !resendFrom || !supabaseUrl || !serviceKey) {
    console.error('Missing RESEND_* or SUPABASE_* env');
    return new Response('Server misconfigured', { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const { table, eventType, record: rec } = parseNotificationWebhookPayload(body);
  if (table !== 'notifications' || (eventType && eventType !== 'INSERT') || !rec?.user_id) {
    return new Response('Ignored', { status: 200 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('email')
    .eq('id', rec.user_id)
    .maybeSingle();

  let recipientEmail = user?.email?.trim() || null;
  if (!recipientEmail) {
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(rec.user_id);
    if (!authErr && authData?.user?.email) {
      recipientEmail = authData.user.email.trim();
    }
  }

  if (userErr && !recipientEmail) {
    console.warn('No email for user', rec.user_id, userErr.message);
  }
  if (!recipientEmail) {
    console.warn('No email for user', rec.user_id);
    return new Response('No recipient', { status: 200 });
  }

  const profilePrefs = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', rec.user_id)
    .maybeSingle();

  const emailOn = (profilePrefs.data?.preferences as { notifications?: { email?: boolean } } | null)?.notifications
    ?.email;
  if (emailOn === false) {
    return new Response('User opted out of email', { status: 200 });
  }

  const { subject, text } = genericEmailForType(rec.type);

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [recipientEmail],
      subject,
      text: `${text}\n\n— LinkUp`,
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    console.error('Resend error', r.status, errText);
    return new Response('Resend failed', { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
