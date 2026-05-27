import * as Linking from 'expo-linking';
import { getPaystackPublicKey, paystackCheckoutUrl } from '@/lib/paystack';

export type OpenEscrowCheckoutArgs = {
  email: string;
  amountKobo: number;
  escrowId: string;
  planId: string;
  /** Pattern B — which leg is being funded */
  escrowLeg?: 'host' | 'guest';
};

/** Opens Paystack hosted checkout. Public key only; verification happens on the server/webhook. */
export async function openEscrowPaystackCheckout(args: OpenEscrowCheckoutArgs): Promise<{
  ok: boolean;
  error?: string;
  reference: string;
  url?: string;
}> {
  const pk = getPaystackPublicKey();
  if (!pk) {
    return { ok: false, error: 'Paystack is not configured (EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY).', reference: '' };
  }
  if (!args.email) {
    return { ok: false, error: 'Add an email on your account to pay.', reference: '' };
  }

  const reference = `escrow-${args.escrowId}-${args.escrowLeg ?? 'full'}-${Date.now()}`;
  const callbackUrl =
    process.env.EXPO_PUBLIC_PAYSTACK_ESCROW_CALLBACK_URL ?? Linking.createURL(`/escrow/${args.escrowId}`);

  const meta: Record<string, string> = {
    escrow_id: args.escrowId,
    plan_id: args.planId,
    linkup: 'escrow',
    transaction_type: 'escrow',
  };
  if (args.escrowLeg) meta.escrow_leg = args.escrowLeg;

  const url = paystackCheckoutUrl({
    email: args.email,
    amountKobo: args.amountKobo,
    reference,
    callbackUrl,
    metadata: meta,
  });

  const can = await Linking.canOpenURL(url);
  if (!can) {
    return { ok: false, error: 'Cannot open checkout on this device.', reference, url };
  }
  await Linking.openURL(url);
  return { ok: true, reference, url };
}
