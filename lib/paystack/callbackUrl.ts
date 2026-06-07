/**
 * Paystack callback URLs must be stable deep links — not exp:// dev URLs (WAF / redirect issues).
 */
const APP_SCHEME = 'linkup';

export function getPremiumPaystackCallbackUrl(): string {
  const custom = process.env.EXPO_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL?.trim();
  if (custom) return custom;
  return `${APP_SCHEME}://premium/success`;
}

export function getEscrowPaystackCallbackUrl(escrowId: string): string {
  const custom = process.env.EXPO_PUBLIC_PAYSTACK_ESCROW_CALLBACK_URL?.trim();
  if (custom) return custom.replace('[id]', escrowId);
  return `${APP_SCHEME}://escrow/${escrowId}`;
}

/** Paystack + mobile browsers reject exp:// and other non-http(s) dev URLs in production checkout. */
export function isAllowedPaystackCallbackUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (/^linkup:\/\//i.test(u)) return true;
  if (/^https:\/\//i.test(u)) return true;
  return false;
}

export function paystackCallbackUrlError(): string {
  return (
    'Set EXPO_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL=linkup://premium/success in .env ' +
    '(do not use exp:// URLs from Expo dev — Paystack may block them).'
  );
}
