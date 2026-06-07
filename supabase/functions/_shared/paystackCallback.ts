/** Map app return URL → HTTPS URL Paystack accepts for callback_url. */
export function paystackHttpsCallbackUrl(supabaseUrl: string, returnUrl: string): string | null {
  const trimmed = returnUrl.trim();
  if (!trimmed) return null;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^linkup:\/\//i.test(trimmed)) {
    return checkoutReturnBridge(supabaseUrl, trimmed);
  }
  // LinkUp web local dev — Paystack → HTTPS bridge → http://localhost success page
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)) {
    return checkoutReturnBridge(supabaseUrl, trimmed);
  }
  return null;
}

function checkoutReturnBridge(supabaseUrl: string, redirect: string): string {
  const base = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/paystack-checkout-return`;
  return `${base}?redirect=${encodeURIComponent(redirect)}`;
}
