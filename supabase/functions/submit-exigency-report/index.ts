/**
 * Multipart: plan_id, reason_type, reason_text, evidence? (file)
 * Header: Authorization: Bearer <user access token>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'private_disputes';
const FORCE_TYPES = new Set(['illness', 'accident', 'emergency']);

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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceKey) {
    return new Response('Server misconfigured', { status: 500, headers: cors });
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const formData = await req.formData();
  const planId = formData.get('plan_id') as string | null;
  const reasonType = formData.get('reason_type') as string | null;
  const reasonText = formData.get('reason_text') as string | null;
  const evidenceFile = formData.get('evidence');

  if (!planId || !reasonType || !reasonText?.trim()) {
    return new Response(
      JSON.stringify({ error: 'plan_id, reason_type, and reason_text are required' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const serviceClient = createClient(url, serviceKey);

  const { data: plan } = await serviceClient
    .from('plans')
    .select('scheduled_at, is_group_plan')
    .eq('id', planId)
    .single();

  if (!plan?.is_group_plan) {
    return new Response(JSON.stringify({ error: 'Not a group plan' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const scheduledAt = new Date(plan.scheduled_at as string);
  const cutoff = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);
  if (new Date() > cutoff) {
    return new Response(
      JSON.stringify({
        error:
          'The 24-hour submission window has passed. Outcome 3 applies automatically.',
      }),
      { status: 422, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  let evidencePath: string | null = null;
  if (evidenceFile instanceof File && evidenceFile.size > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    evidencePath = `exigency-evidence/${user.id}/${planId}/${ts}-${evidenceFile.name}`;
    const { error: upErr } = await serviceClient.storage
      .from(BUCKET)
      .upload(evidencePath, evidenceFile, { upsert: false });
    if (upErr) {
      return new Response(JSON.stringify({ error: 'Evidence upload failed.' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  }

  const isForce = FORCE_TYPES.has(reasonType);
  const deadlineHours = isForce ? 72 : 48;
  const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

  const { data: report, error } = await serviceClient
    .from('exigency_reports')
    .insert({
      plan_id: planId,
      user_id: user.id,
      reason_type: reasonType,
      reason_text: reasonText.trim(),
      evidence_storage_path: evidencePath,
      outcome: 'pending_review',
      review_deadline_at: deadline.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return new Response(
        JSON.stringify({ error: 'You have already submitted an Exigency Report for this plan.' }),
        { status: 409, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  await serviceClient.rpc('create_notification', {
    p_user_id: user.id,
    p_type: 'exigency_submitted',
    p_title: 'Exigency Report received',
    p_body: `Your report is under review. We will notify you of the outcome within ${deadlineHours} hours.`,
    p_data: { href: '/wallet' },
  });

  return new Response(
    JSON.stringify({
      report_id: report.id,
      review_deadline: deadline.toISOString(),
      review_hours: deadlineHours,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
});
