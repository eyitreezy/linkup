/**
 * POST JSON: { "plan_id": "<uuid>" }
 * Header: Authorization: Bearer <user access token>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
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
  if (!url || !anon) {
    return new Response('Server misconfigured', { status: 500, headers: cors });
  }

  let body: { plan_id?: string };
  try {
    body = (await req.json()) as { plan_id?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!body.plan_id) {
    return new Response(JSON.stringify({ error: 'plan_id required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });

  const { data, error } = await supabase.rpc('submit_arrival_nudge', {
    p_plan_id: body.plan_id,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 422,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
