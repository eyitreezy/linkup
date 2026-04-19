/**
 * Database Webhook target — send Expo push when a row is inserted into public.notifications.
 *
 * Wire-up: Supabase Dashboard → Database → Webhooks → notifications → INSERT → POST this function URL
 * Header: x-linkup-webhook-secret: <PUSH_NOTIFICATION_WEBHOOK_SECRET>
 *
 * Use this so SQL triggers (offer, message, etc.) get push without duplicating logic in each trigger.
 * If you also send push from paystack-webhook-* functions, disable push here for duplicate types or
 * only attach this webhook for non-paystack events.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUSH_NOTIFICATION_WEBHOOK_SECRET
 */
import { sendExpoPushIfAllowed } from '../_shared/expoPush.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: {
    user_id?: string;
    type?: string;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('PUSH_NOTIFICATION_WEBHOOK_SECRET');
  const sent = req.headers.get('x-linkup-webhook-secret');
  if (!secret || sent !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const rec = payload.record;
  if (payload.table !== 'notifications' || payload.type !== 'INSERT' || !rec?.user_id || !rec.title || !rec.body) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Skip if paystack functions already pushed (optional belt-and-suspenders). */
  const skipTypes = new Set(['escrow_funded', 'premium_activated']);
  if (rec.type && skipTypes.has(rec.type)) {
    return new Response(JSON.stringify({ ok: true, skipped: rec.type }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500 });
  }

  const data = { ...(rec.data ?? {}), type: rec.type };
  await sendExpoPushIfAllowed(supabase, rec.user_id, rec.title, rec.body, data);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
