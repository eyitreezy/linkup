/**
 * POST JSON: { session_id }
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

  const serviceClient = createClient(url, serviceKey);
  const { session_id } = (await req.json()) as { session_id?: string };

  const { data: session } = await serviceClient
    .from('live_location_sessions')
    .select('id, sharer_id')
    .eq('id', session_id)
    .eq('sharer_id', user.id)
    .maybeSingle();

  if (!session) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  await serviceClient
    .from('live_location_sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', session_id);

  await serviceClient.from('live_location_pings').delete().eq('session_id', session_id);

  return new Response(JSON.stringify({ stopped: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
