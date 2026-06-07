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

/**
 * @deprecated Use `paystack-initialize` Edge Function only.
 * Putting metadata in query strings can trigger Paystack WAF blocks.
 */
export function paystackCheckoutUrl(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
}): string {
  const pk = getPaystackPublicKey();
  return `https://checkout.paystack.com/?pk=${encodeURIComponent(pk)}&email=${encodeURIComponent(opts.email)}&amount=${opts.amountKobo}&ref=${encodeURIComponent(opts.reference)}&callback_url=${encodeURIComponent(opts.callbackUrl)}`;
}
