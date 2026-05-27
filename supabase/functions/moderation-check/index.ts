/**
 * Server-side moderation log + optional auto-hide + admin ping (high severity).
 *
 * Invoke from app with Authorization: Bearer <user access_token>.
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Body: { content_type, content_id, text_sample }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type ContentType = 'message' | 'plan' | 'profile';

type Sev = 'low' | 'medium' | 'high';
type Flag = 'spam' | 'abuse' | 'scam' | 'explicit' | 'other';
type Action = 'none' | 'hidden' | 'warned' | 'banned';

function analyze(text: string): {
  flag_type: Flag;
  severity: Sev;
  score: number;
} {
  const lower = text.toLowerCase();
  let flag_type: Flag = 'other';
  let severity: Sev = 'low';
  const flags: string[] = [];

  if (/kill yourself|kys\b/i.test(text)) {
    flag_type = 'abuse';
    severity = 'high';
    flags.push('abuse');
  } else if (/click here|free money|send money|whatsapp\s*\+?\d{9,}/i.test(lower)) {
    flag_type = 'scam';
    severity = 'high';
    flags.push('scam');
  } else if (/porn|xxx|nsfw/i.test(lower)) {
    flag_type = 'explicit';
    severity = 'medium';
  } else if (lower.length > 1800) {
    flag_type = 'spam';
    severity = 'low';
  }

  const score = Math.max(0, Math.min(1, 0.2 + flags.length * 0.35 + (severity === 'high' ? 0.35 : 0)));
  return { flag_type, severity, score };
}

async function notifyAdminsModeration(supabase: ReturnType<typeof getSupabaseAdmin>, dedupe: string): Promise<void> {
  const { data: rows, error } = await supabase.from('admins').select('user_id');
  if (error || !rows?.length) return;
  for (const r of rows) {
    const uid = r.user_id as string;
    await supabase.rpc('create_notification', {
      p_user_id: uid,
      p_type: 'moderation_flagged',
      p_title: 'Moderation review',
      p_body: 'Automated checks flagged content. Open the admin console to review.',
      p_data: { href: '/admin' },
      p_priority: 'high',
      p_dedupe_key: `${dedupe}:admin:${uid}`,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  if (!url || !anonKey || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response('Invalid session', { status: 401 });
  }

  let body: { content_type?: string; content_id?: string; text_sample?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const content_type = body.content_type as ContentType | undefined;
  const content_id = typeof body.content_id === 'string' ? body.content_id : null;
  const text_sample = typeof body.text_sample === 'string' ? body.text_sample : '';

  if (!content_type || !content_id || !['message', 'plan', 'profile'].includes(content_type)) {
    return new Response(JSON.stringify({ error: 'Invalid content_type or content_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { flag_type, severity, score } =
    text_sample.trim().length > 0
      ? analyze(text_sample)
      : { flag_type: 'other' as Flag, severity: 'low' as Sev, score: 0.1 };

  let action_taken: Action = 'none';

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return new Response('Server misconfigured', { status: 500 });
  }

  if (severity === 'high') {
    if (content_type === 'message') {
      const { error: mErr } = await supabase
        .from('messages')
        .update({ moderation_status: 'blocked' })
        .eq('id', content_id)
        .eq('sender_id', user.id);
      if (!mErr) action_taken = 'hidden';
    } else if (content_type === 'plan') {
      const { error: pErr } = await supabase
        .from('plans')
        .update({ is_suppressed: true })
        .eq('id', content_id)
        .eq('creator_id', user.id);
      if (!pErr) action_taken = 'hidden';
    }
    await notifyAdminsModeration(supabase, `mod:${content_type}:${content_id}`);
  }

  const { error: insErr } = await supabase.from('moderation_logs').insert({
    user_id: user.id,
    content_type,
    content_id,
    flag_type,
    severity,
    ai_score: score,
    action_taken,
  });

  if (insErr) {
    console.error('moderation_logs', insErr.message);
    return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, severity, action_taken }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
