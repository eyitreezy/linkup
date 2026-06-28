import {
  isTrustedHostedCheckoutUrl,
  normalizeFlutterwaveCheckoutUrl,
} from '@/lib/flutterwave/checkoutHosts';
import { FunctionsHttpError } from '@supabase/supabase-js';

/** Extract a hosted checkout URL from a Supabase edge-function invoke body. */
export function parsePaymentLinkFromInvoke(data: unknown): string | null {
  if (!data) return null;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed.startsWith('{')) {
      return pickTrustedLink(trimmed);
    }
    try {
      return parsePaymentLinkFromInvoke(JSON.parse(trimmed) as unknown);
    } catch {
      return pickTrustedLink(trimmed);
    }
  }

  if (typeof data !== 'object') return null;

  const row = data as Record<string, unknown>;
  const nested = row.data;
  const candidates = [
    row.payment_link,
    row.link,
    typeof nested === 'object' && nested ? (nested as Record<string, unknown>).link : null,
    typeof nested === 'object' && nested ? (nested as Record<string, unknown>).payment_link : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trusted = pickTrustedLink(candidate);
    if (trusted) return trusted;
  }

  return null;
}

function pickTrustedLink(raw: string): string | null {
  const normalized = normalizeFlutterwaveCheckoutUrl(raw);
  if (!normalized || !isTrustedHostedCheckoutUrl(normalized)) return null;
  return normalized;
}

export async function getInvokeErrorMessage(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }

  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.clone().json()) as { error?: unknown; message?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error.trim();
      if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
    } catch {
      // ignore JSON parse failures
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Could not start checkout';
}

export function userFacingCheckoutError(raw: string): string {
  if (/invalid checkout link/i.test(raw)) {
    return "We couldn't open the payment page. Please try again in a moment. If this keeps happening, contact support.";
  }
  if (/payment initialization failed/i.test(raw) || /non-2xx status/i.test(raw)) {
    return "Payment couldn't be started right now. Check your connection and try again shortly.";
  }
  if (/server misconfigured/i.test(raw)) {
    return 'Checkout is temporarily unavailable. Please try again later or contact support.';
  }
  if (/unauthorized|forbidden/i.test(raw)) {
    return 'Please sign in again, then retry checkout.';
  }
  if (/no payment link/i.test(raw)) {
    return "We couldn't get a payment link from the server. Please try again shortly.";
  }
  return raw;
}
