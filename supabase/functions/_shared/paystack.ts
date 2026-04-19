/**
 * Verify Paystack webhook signature (HMAC SHA512 of raw body with secret key).
 * @see https://paystack.com/docs/payments/webhooks
 */

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretKey: string
): Promise<boolean> {
  if (!signatureHeader || !secretKey) return false;
  const hash = await hmacSha512Hex(secretKey, rawBody);
  return hash === signatureHeader;
}

export type PaystackChargeSuccess = {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
    customer?: { email?: string };
  };
};

export function parsePaystackBody(raw: string): PaystackChargeSuccess | null {
  try {
    return JSON.parse(raw) as PaystackChargeSuccess;
  } catch {
    return null;
  }
}
