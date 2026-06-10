import {
  flutterwaveCallbackUrlError,
  getEscrowCallbackUrl,
  isAllowedFlutterwaveCallbackUrl,
} from '@/lib/flutterwave/callbackUrl';
import { openFlutterwaveCheckoutInBrowser } from '@/lib/flutterwave/openFlutterwaveBrowser';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type OpenEscrowCheckoutArgs = {
  email: string;
  amountKobo: number;
  escrowId: string;
  planId: string;
  /** Pattern B — which leg is being funded */
  escrowLeg?: 'host' | 'guest';
};

/** Opens Flutterwave checkout via server initialize (required — no client-side amount). */
export async function openEscrowCheckout(args: OpenEscrowCheckoutArgs): Promise<{
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
      error: 'Supabase is not configured. Escrow checkout requires create-escrow-payment on the server.',
      reference: '',
    };
  }

  const callbackUrl = getEscrowCallbackUrl(args.escrowId);
  if (!isAllowedFlutterwaveCallbackUrl(callbackUrl)) {
    return { ok: false, error: flutterwaveCallbackUrlError(), reference: '' };
  }

  const { data, error } = await supabase.functions.invoke('create-escrow-payment', {
    body: {
      escrow_id: args.escrowId,
      plan_id: args.planId,
      escrow_leg: args.escrowLeg,
    },
  });

  if (error) {
    return { ok: false, error: error.message, reference: '' };
  }

  const row = data as { payment_link?: string; tx_ref?: string; error?: string } | null;
  if (!row?.payment_link || !row.tx_ref) {
    return { ok: false, error: row?.error ?? 'Could not start escrow checkout.', reference: '' };
  }

  const opened = await openFlutterwaveCheckoutInBrowser(row.payment_link, callbackUrl);
  if (!opened.ok) {
    return {
      ok: false,
      error: opened.error,
      reference: row.tx_ref,
      url: row.payment_link,
    };
  }

  return {
    ok: true,
    reference: row.tx_ref,
    url: row.payment_link,
  };
}