/**
 * POST JSON: { plan_id, duration_minutes: 15 | 60 | -1 }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const auth = req.headers.get('Authorization');
  if (!auth) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceKey) {
    return new Response('Server misconfigured', { status: 500, headers: cors });
  }

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let body: { plan_id?: string; duration_minutes?: number };
  try {
    body = (await req.json()) as { plan_id?: string; duration_minutes?: number };
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { plan_id, duration_minutes } = body;
  if (!plan_id || duration_minutes == null || ![15, 60, -1].includes(duration_minutes)) {
    return new Response(
      JSON.stringify({ error: 'plan_id and duration_minutes (15, 60, or -1) required' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const serviceClient = createClient(url, serviceKey);

  const { data: plan } = await serviceClient
    .from('plans')
    .select('id, creator_id')
    .eq('id', plan_id)
    .single();

  const { data: offer } = await serviceClient
    .from('plan_offers')
    .select('id')
    .eq('plan_id', plan_id)
    .eq('bidder_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle();

  if (plan?.creator_id !== user.id && !offer) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: consent } = await serviceClient
    .from('live_location_consents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!consent) {
    return new Response(JSON.stringify({ error: 'ndpr_consent_required' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  await serviceClient
    .from('live_location_sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('plan_id', plan_id)
    .eq('sharer_id', user.id)
    .eq('is_active', true);

  const expiresAt =
    duration_minutes === -1
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + duration_minutes * 60 * 1000).toISOString();

  const { data: session, error } = await serviceClient
    .from('live_location_sessions')
    .insert({
      plan_id,
      sharer_id: user.id,
      expires_at: expiresAt,
      duration_minutes,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !session) {
    return new Response(JSON.stringify({ error: error?.message ?? 'session_create_failed' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let recipientId: string | null = null;
  if (plan?.creator_id === user.id) {
    const { data: guest } = await serviceClient
      .from('plan_offers')
      .select('bidder_id')
      .eq('plan_id', plan_id)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();
    recipientId = guest?.bidder_id ?? null;
  } else {
    recipientId = plan?.creator_id ?? null;
  }

  if (recipientId) {
    await serviceClient.rpc('create_notification', {
      p_user_id: recipientId,
      p_type: 'live_location_started',
      p_title: 'Your meetup partner is sharing their location',
      p_body: 'Open the plan chat to see their live location.',
      p_data: { href: `/plan/${plan_id}`, planId: plan_id },
      p_priority: 'high',
      p_dedupe_key: null,
    });
  }

  return new Response(
    JSON.stringify({ session_id: session.id, expires_at: expiresAt }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
});
