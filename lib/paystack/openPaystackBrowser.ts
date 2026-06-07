/**
 * Open Paystack hosted checkout and return to the app via deep link.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const CHECKOUT_HOSTS = ['checkout.paystack.com', 'standard.paystack.com'];

export function isPaystackCheckoutUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return CHECKOUT_HOSTS.includes(host);
  } catch {
    return false;
  }
}

export async function openPaystackCheckoutInBrowser(
  authorizationUrl: string,
  returnUrl: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isPaystackCheckoutUrl(authorizationUrl)) {
    return {
      ok: false,
      error: 'Invalid checkout link from server. Redeploy paystack-initialize and try again.',
    };
  }

  try {
    // returnUrl must match the final linkup:// redirect (Paystack → HTTPS bridge → 302 → deep link)
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl, {
      showInRecents: true,
      preferEphemeralSession: false,
    });
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, error: 'Checkout closed before payment completed.' };
    }
    return { ok: true };
  } catch {
    const can = await Linking.canOpenURL(authorizationUrl);
    if (!can) return { ok: false, error: 'Cannot open Paystack checkout on this device.' };
    await Linking.openURL(authorizationUrl);
    return { ok: true };
  }
}
