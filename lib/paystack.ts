/**
 * Paystack — client uses PUBLIC key only.
 * Initialize transaction / verify / split should run on Supabase Edge Functions with PAYSTACK_SECRET_KEY.
 */
import Constants from 'expo-constants';

export function getPaystackPublicKey(): string {
  return (
    process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ??
    (Constants.expoConfig?.extra?.paystackPublicKey as string) ??
    ''
  );
}

/** Build Paystack Inline payment URL (opens in browser / WebView). MVP helper. */
export function paystackCheckoutUrl(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
}): string {
  const pk = getPaystackPublicKey();
  const meta = encodeURIComponent(JSON.stringify(opts.metadata ?? {}));
  return `https://checkout.paystack.com/?pk=${encodeURIComponent(pk)}&email=${encodeURIComponent(opts.email)}&amount=${opts.amountKobo}&ref=${encodeURIComponent(opts.reference)}&callback_url=${encodeURIComponent(opts.callbackUrl)}&metadata=${meta}`;
}
