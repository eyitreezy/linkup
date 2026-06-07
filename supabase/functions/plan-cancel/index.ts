/**
 * CORS + JWT → `submit_plan_cancellation` RPC (role/timing matrix, Pattern B splits).
 *
 * POST JSON: { "plan_id": "<uuid>", "no_show": false }
 * Header: Authorization: Bearer <user access token>
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY
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

  let body: { plan_id?: string; no_show?: boolean };
  try {
    body = (await req.json()) as { plan_id?: string; no_show?: boolean };
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const planId = body.plan_id;
  if (!planId) {
    return new Response(JSON.stringify({ error: 'plan_id_required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });

  const { data, error } = await supabase.rpc('submit_plan_cancellation', {
    p_plan_id: planId,
    p_no_show: !!body.no_show,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, result: data }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
