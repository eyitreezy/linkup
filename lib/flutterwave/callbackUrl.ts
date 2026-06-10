const APP_SCHEME = 'linkup';

export function getSubscriptionCallbackUrl(): string {
  return `${APP_SCHEME}://subscription/callback`;
}

export function getEscrowCallbackUrl(escrowId: string): string {
  return `${APP_SCHEME}://escrow/${escrowId}`;
}

export function isAllowedFlutterwaveCallbackUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /^linkup:\/\//i.test(u) || /^https:\/\//i.test(u);
}

export function flutterwaveCallbackUrlError(): string {
  return 'Payment return URL must use linkup:// deep links (e.g. linkup://escrow/[id]).';
}
