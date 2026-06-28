import { useCallback, useState } from 'react';
import { isTrustedHostedCheckoutUrl, normalizeFlutterwaveCheckoutUrl } from '@/lib/flutterwave/checkoutHosts';
import { openFlutterwaveCheckoutInBrowser } from '@/lib/flutterwave/openFlutterwaveBrowser';
import { shouldUseFlutterwaveInAppWebView } from '@/lib/flutterwave/shouldUseFlutterwaveInAppWebView';

export type FlutterwaveCheckoutSession = {
  url: string;
  returnUrl: string;
};

export type BeginCheckoutResult =
  | { ok: true; mode: 'modal' | 'browser' }
  | { ok: false; error?: string };

export function useFlutterwaveCheckout() {
  const [session, setSession] = useState<FlutterwaveCheckoutSession | null>(null);

  const beginCheckout = useCallback(
    async (url: string, returnUrl: string): Promise<BeginCheckoutResult> => {
      const normalized = normalizeFlutterwaveCheckoutUrl(url);
      if (!normalized || !isTrustedHostedCheckoutUrl(normalized)) {
        return {
          ok: false,
          error: 'Invalid checkout link from server. Redeploy create-subscription / create-escrow-payment.',
        };
      }

      const trimmedReturn = returnUrl.trim();

      if (!shouldUseFlutterwaveInAppWebView()) {
        const opened = await openFlutterwaveCheckoutInBrowser(normalized, trimmedReturn);
        if (!opened.ok) {
          return { ok: false, error: opened.error ?? 'Could not open checkout in browser.' };
        }
        return { ok: true, mode: 'browser' };
      }

      setSession({ url: normalized, returnUrl: trimmedReturn });
      return { ok: true, mode: 'modal' };
    },
    []
  );

  const dismissCheckout = useCallback(() => {
    setSession(null);
  }, []);

  return {
    session,
    beginCheckout,
    dismissCheckout,
    clearCheckout: dismissCheckout,
  };
}
