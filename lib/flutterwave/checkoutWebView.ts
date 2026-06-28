import { Platform } from 'react-native';
import { isTrustedHostedCheckoutUrl } from '@/lib/flutterwave/checkoutHosts';

/** Mobile Chrome UA — Flutterwave hosted checkout often blocks generic WebView UAs. */
export const FLUTTERWAVE_CHECKOUT_USER_AGENT =
  Platform.select({
    ios:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    android:
      'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    default:
      'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  }) ?? 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export function isFlutterwaveCheckoutPageUrl(url: string): boolean {
  return isTrustedHostedCheckoutUrl(url);
}
