/**
 * POST JSON: { plan_id, reason_type, reason_text? }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_REASONS = [
  'logistical_issue',
  'personal_emergency',
  'insufficient_group_size',
  'venue_issue',
  'other',
];

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
  if (!url || !anon) {
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

  const { plan_id, reason_type, reason_text } = (await req.json()) as {
    plan_id?: string;
    reason_type?: string;
    reason_text?: string;
  };

  if (!plan_id || !reason_type) {
    return new Response(JSON.stringify({ error: 'plan_id and reason_type required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!VALID_REASONS.includes(reason_type)) {
    return new Response(JSON.stringify({ error: 'invalid reason_type' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (reason_type === 'other' && !reason_text?.trim()) {
    return new Response(JSON.stringify({ error: 'reason_text required when reason_type is other' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await userClient.rpc('submit_group_host_cancellation', {
    p_plan_id: plan_id,
    p_reason_type: reason_type,
    p_reason_text: reason_text?.trim() ?? null,
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
