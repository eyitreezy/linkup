/** Hosted Flutterwave checkout hostnames (prod + dev + legacy). */
const CHECKOUT_HOST_SUFFIXES = [
  'flutterwave.com',
  'ravepay.co',
  'flw.pub',
  'herokuapp.com',
] as const;

const CHECKOUT_BASE = 'https://checkout.flutterwave.com';

/** Normalize Flutterwave hosted links returned without a scheme or host. */
export function normalizeFlutterwaveCheckoutUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `${CHECKOUT_BASE}${trimmed}`;

  const withScheme = /^[a-z0-9.-]+\//i.test(trimmed) ? `https://${trimmed}` : null;
  return withScheme ?? (trimmed.includes('.') ? `https://${trimmed}` : null);
}

export function isFlutterwaveCheckoutUrl(url: string): boolean {
  return isTrustedHostedCheckoutUrl(url);
}

/** Accept hosted checkout URLs from Flutterwave (incl. legacy/sandbox hosts). */
export function isTrustedHostedCheckoutUrl(url: string): boolean {
  const normalized = normalizeFlutterwaveCheckoutUrl(url);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (/^linkup:/i.test(normalized)) return false;

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (CHECKOUT_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
      return true;
    }
    if (host.includes('flutterwave') || host.includes('ravepay') || host.includes('flw.')) {
      return true;
    }
    if (path.includes('/hosted/pay') || path.includes('flwlnk')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
