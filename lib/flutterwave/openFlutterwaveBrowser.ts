/**
 * Open Flutterwave hosted checkout and return to the app via deep link.
 * Prefer in-app {@link FlutterwaveCheckoutModal} on mobile for narrow-viewport fit.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  isTrustedHostedCheckoutUrl,
  normalizeFlutterwaveCheckoutUrl,
} from '@/lib/flutterwave/checkoutHosts';

WebBrowser.maybeCompleteAuthSession();

export async function openFlutterwaveCheckoutInBrowser(
  paymentLink: string,
  returnUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeFlutterwaveCheckoutUrl(paymentLink);
  if (!normalized || !isTrustedHostedCheckoutUrl(normalized)) {
    return {
      ok: false,
      error: 'Invalid checkout link from server. Redeploy create-subscription / create-escrow-payment.',
    };
  }

  try {
    const result = await WebBrowser.openAuthSessionAsync(normalized, returnUrl, {
      showInRecents: true,
      preferEphemeralSession: false,
      ...(WebBrowser.WebBrowserPresentationStyle && {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      }),
    });
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, error: 'Checkout closed before payment completed.' };
    }
    return { ok: true };
  } catch {
    const can = await Linking.canOpenURL(normalized);
    if (!can) return { ok: false, error: 'Cannot open Flutterwave checkout on this device.' };
    await Linking.openURL(normalized);
    return { ok: true };
  }
}
