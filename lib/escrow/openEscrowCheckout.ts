import {
  getEscrowPaystackCallbackUrl,
  isAllowedPaystackCallbackUrl,
  paystackCallbackUrlError,
} from '@/lib/paystack/callbackUrl';
import { invokePaystackInitialize } from '@/lib/paystack/invokePaystackInitialize';
import { openPaystackCheckoutInBrowser } from '@/lib/paystack/openPaystackBrowser';
import { isSupabaseConfigured } from '@/lib/supabase';

export type OpenEscrowCheckoutArgs = {
  email: string;
  amountKobo: number;
  escrowId: string;
  planId: string;
  /** Pattern B — which leg is being funded */
  escrowLeg?: 'host' | 'guest';
};

/** Opens Paystack checkout via server initialize (required — no legacy URL fallback). */
export async function openEscrowPaystackCheckout(args: OpenEscrowCheckoutArgs): Promise<{
  ok: boolean;
  error?: string;
  reference: string;
  url?: string;
}> {
  if (!args.email?.trim()) {
    return { ok: false, error: 'Add an email on your account to pay.', reference: '' };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase is not configured. Escrow checkout requires paystack-initialize on the server.',
      reference: '',
    };
  }

  const callbackUrl = getEscrowPaystackCallbackUrl(args.escrowId);
  if (!isAllowedPaystackCallbackUrl(callbackUrl)) {
    return { ok: false, error: paystackCallbackUrlError(), reference: '' };
  }

  const init = await invokePaystackInitialize({
    kind: 'escrow',
    email: args.email.trim(),
    amount_kobo: args.amountKobo,
    callback_url: callbackUrl,
    escrow_id: args.escrowId,
    plan_id: args.planId,
    escrow_leg: args.escrowLeg,
  });

  if (!init.ok) {
    return { ok: false, error: init.error, reference: '' };
  }

  const opened = await openPaystackCheckoutInBrowser(init.data.authorization_url, callbackUrl);
  if (!opened.ok) {
    return {
      ok: false,
      error: opened.error,
      reference: init.data.reference,
      url: init.data.authorization_url,
    };
  }

  return {
    ok: true,
    reference: init.data.reference,
    url: init.data.authorization_url,
  };
}
