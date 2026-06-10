/**
 * Open Flutterwave hosted checkout and return to the app via deep link.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const CHECKOUT_HOSTS = ['flutterwave.com', 'ravepay.co', 'flw.pub'];

export function isFlutterwaveCheckoutUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return CHECKOUT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function openFlutterwaveCheckoutInBrowser(
  paymentLink: string,
  returnUrl: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isFlutterwaveCheckoutUrl(paymentLink)) {
    return {
      ok: false,
      error: 'Invalid checkout link from server. Redeploy create-subscription / create-escrow-payment.',
    };
  }

  try {
    const result = await WebBrowser.openAuthSessionAsync(paymentLink, returnUrl, {
      showInRecents: true,
      preferEphemeralSession: false,
    });
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, error: 'Checkout closed before payment completed.' };
    }
    return { ok: true };
  } catch {
    const can = await Linking.canOpenURL(paymentLink);
    if (!can) return { ok: false, error: 'Cannot open Flutterwave checkout on this device.' };
    await Linking.openURL(paymentLink);
    return { ok: true };
  }
}
