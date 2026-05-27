/**
 * Send a test Expo push to one user (debug / verify setup).
 *
 * Deploy: supabase functions deploy test-expo-push --no-verify-jwt
 * Secret: PUSH_TEST_SECRET (same value in x-push-test-secret header)
 *
 * curl -X POST 'https://<ref>.supabase.co/functions/v1/test-expo-push' \
 *   -H 'Content-Type: application/json' \
 *   -H 'x-push-test-secret: YOUR_SECRET' \
 *   -d '{"userId":"<uuid>"}'
 */
import { sendExpoPushIfAllowed } from '../_shared/expoPush.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expected = Deno.env.get('PUSH_TEST_SECRET');
  const sent = req.headers.get('x-push-test-secret');
  if (!expected || sent !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { userId?: string };
  try {
    body = (await req.json()) as { userId?: string };
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  if (!body.userId?.trim()) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
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

  await sendExpoPushIfAllowed(supabase, body.userId.trim(), 'LinkUp test', 'Push notifications are working.', {
    type: 'test',
    href: '/notifications',
  });

  return new Response(JSON.stringify({ ok: true, userId: body.userId }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
