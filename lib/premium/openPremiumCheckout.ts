import * as Linking from 'expo-linking';
import { paystackCheckoutUrl, getPaystackPublicKey } from '@/lib/paystack';
import type { PremiumTier } from '@/lib/premium/catalog';

export async function openPremiumPaystackCheckout(opts: {
  email: string;
  userId: string;
  tier: PremiumTier;
}): Promise<{ ok: boolean; error?: string; reference: string }> {
  const pk = getPaystackPublicKey();
  if (!pk) return { ok: false, error: 'Paystack is not configured.', reference: '' };
  if (!opts.email) return { ok: false, error: 'Add an email to your account.', reference: '' };

  const reference = `linkup-premium-${opts.tier.id}-${opts.userId}-${Date.now()}`;
  const callbackUrl = process.env.EXPO_PUBLIC_PAYSTACK_PREMIUM_CALLBACK_URL ?? Linking.createURL('/premium/success');

  const url = paystackCheckoutUrl({
    email: opts.email,
    amountKobo: opts.tier.priceKobo,
    reference,
    callbackUrl,
    metadata: {
      linkup: 'premium',
      transaction_type: 'premium',
      tier_id: opts.tier.id,
      user_id: opts.userId,
    },
  });

  const can = await Linking.canOpenURL(url);
  if (!can) return { ok: false, error: 'Cannot open checkout.', reference };
  await Linking.openURL(url);
  return { ok: true, reference };
}
