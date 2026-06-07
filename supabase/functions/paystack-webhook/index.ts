/**
 * Single Paystack webhook URL for the dashboard (Test + Live each allow one URL).
 * Routes charge.success to paystack-webhook-escrow or paystack-webhook-premium by metadata.
 *
 * Paystack Dashboard → Settings → API Keys & Webhooks → Test/Live Webhook URL:
 *   https://<project-ref>.supabase.co/functions/v1/paystack-webhook
 *
 * Deploy: npx supabase functions deploy paystack-webhook --no-verify-jwt
 */
import { parsePaystackBody, verifyPaystackSignature } from '../_shared/paystack.ts';

function metaString(m: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = m?.[key];
  return typeof v === 'string' ? v : undefined;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!secret || !supabaseUrl) {
    console.error('Missing PAYSTACK_SECRET_KEY or SUPABASE_URL');
    return new Response('Server misconfigured', { status: 500 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('x-paystack-signature');
  if (!(await verifyPaystackSignature(rawBody, sig, secret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const body = parsePaystackBody(rawBody);
  if (!body || body.event !== 'charge.success' || !body.data) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const meta = body.data.metadata ?? {};
  const linkup = metaString(meta, 'linkup');
  const transactionType = metaString(meta, 'transaction_type');

  let target: 'paystack-webhook-escrow' | 'paystack-webhook-premium' | null = null;
  if (linkup === 'escrow' || transactionType === 'escrow') {
    target = 'paystack-webhook-escrow';
  } else if (linkup === 'premium' || transactionType === 'premium') {
    target = 'paystack-webhook-premium';
  }

  if (!target) {
    return new Response(JSON.stringify({ ok: true, ignored: 'unknown_type' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const forwardUrl = `${supabaseUrl}/functions/v1/${target}`;
  const fwd = await fetch(forwardUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': sig ?? '',
    },
    body: rawBody,
  });

  const text = await fwd.text();
  return new Response(text, {
    status: fwd.status,
    headers: { 'Content-Type': 'application/json' },
  });
});
