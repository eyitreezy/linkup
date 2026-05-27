/**
 * KYC vendor webhook — trusted status updates for verification_requests.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KYC_WEBHOOK_SECRET
 *
 * POST JSON:
 * {
 *   "verification_id": "<uuid>",
 *   "result": "approved" | "rejected" | "more_info",
 *   "reason": "<optional>"
 * }
 *
 * Header: x-kyc-webhook-secret: <KYC_WEBHOOK_SECRET>
 *
 * Maps: approved → admin_approved, rejected → admin_rejected, more_info → more_info
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type VendorResult = 'approved' | 'rejected' | 'more_info';

function mapStatus(r: VendorResult): 'admin_approved' | 'admin_rejected' | 'more_info' {
  switch (r) {
    case 'approved':
      return 'admin_approved';
    case 'rejected':
      return 'admin_rejected';
    case 'more_info':
      return 'more_info';
    default:
      return 'more_info';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('KYC_WEBHOOK_SECRET');
  const sent = req.headers.get('x-kyc-webhook-secret');
  if (!secret || sent !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const verificationId = typeof body.verification_id === 'string' ? body.verification_id : null;
  const result = body.result as VendorResult | undefined;
  const reason = typeof body.reason === 'string' ? body.reason : null;

  if (!verificationId || !result || !['approved', 'rejected', 'more_info'].includes(result)) {
    return new Response(JSON.stringify({ error: 'verification_id and valid result required' }), {
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

  const { error: evErr } = await supabase.from('verification_events').insert({
    verification_id: verificationId,
    event_type: 'vendor_update',
    metadata: {
      result,
      reason,
      vendor_payload: body,
    },
  });
  if (evErr) {
    console.error('verification_events insert', evErr.message);
    return new Response(JSON.stringify({ error: evErr.message }), { status: 500 });
  }

  const status = mapStatus(result);
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (reason && (result === 'rejected' || result === 'more_info')) {
    patch.rejection_reason = reason;
  }
  if (result === 'approved') {
    patch.rejection_reason = null;
  }

  const { error: upErr } = await supabase.from('verification_requests').update(patch).eq('id', verificationId);

  if (upErr) {
    console.error('verification_requests update', upErr.message);
    return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
