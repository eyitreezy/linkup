/**
 * Shared Resend sender for transactional Edge Function mail.
 *
 * Uses the same project secrets as `notification-email` (linkup repo):
 *   RESEND_API_KEY, RESEND_FROM (e.g. LinkUp <noreply@flowdecklabs.com>)
 *
 * Auth signup / password reset uses Supabase Auth SMTP separately — not this module.
 */

export type ResendSendParams = {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
};

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; code?: ResendErrorCode };

/** Stable codes for UI + logs (parsed from Resend API responses). */
export type ResendErrorCode =
  | 'domain_not_verified'
  | 'sandbox_recipient_only'
  | 'resend_validation_error'
  | 'email_failed';

/** Map Resend HTTP error bodies to stable codes for the client. */
export function classifyResendError(raw: string, status?: number): ResendErrorCode {
  const lower = raw.toLowerCase();
  if (lower.includes('domain is not verified') || lower.includes('verify your domain')) {
    return 'domain_not_verified';
  }
  if (
    status === 403 &&
    (lower.includes('onboarding@resend.dev') || lower.includes('testing emails'))
  ) {
    return 'sandbox_recipient_only';
  }
  if (lower.includes('validation_error') || lower.includes('invalid')) {
    return 'resend_validation_error';
  }
  return 'email_failed';
}

/** Resend accepts `Name <email@domain.com>` or bare `email@domain.com`. */
export function normalizeResendFrom(raw: string): string {
  const from = raw.trim();
  if (!from) return from;
  if (from.includes('<') && from.includes('>')) return from;
  if (from.includes('@')) return `LinkUp <${from}>`;
  return from;
}

export function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromRaw = Deno.env.get('RESEND_FROM')?.trim();
  if (!apiKey || !fromRaw) return null;
  return { apiKey, from: normalizeResendFrom(fromRaw) };
}

/** Plain-text footer used by notification-email and meet-type mail. */
export function withLinkUpTextFooter(body: string): string {
  const trimmed = body.trimEnd();
  return `${trimmed}\n\nLinkUp`;
}

export async function sendResendEmail(params: ResendSendParams): Promise<ResendSendResult> {
  const config = getResendConfig();
  if (!config) {
    return { ok: false, status: 503, error: 'Missing RESEND_API_KEY or RESEND_FROM' };
  }

  if (!params.text && !params.html) {
    return { ok: false, status: 400, error: 'text or html required' };
  }

  const payload: Record<string, unknown> = {
    from: config.from,
    to: params.to,
    subject: params.subject,
  };
  if (params.text) payload.text = params.text;
  if (params.html) payload.html = params.html;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[resend] send failed', response.status, errText);
    return {
      ok: false,
      status: response.status,
      error: errText || 'Resend failed',
      code: classifyResendError(errText, response.status),
    };
  }

  let body: { id?: string } = {};
  try {
    body = (await response.json()) as { id?: string };
  } catch {
    return { ok: false, status: 502, error: 'Resend response not JSON' };
  }

  if (!body.id) {
    console.error('[resend] missing id', body);
    return { ok: false, status: 502, error: 'Resend missing email id' };
  }

  return { ok: true, id: body.id };
}
