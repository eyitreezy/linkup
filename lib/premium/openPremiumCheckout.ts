import {
  getPremiumPaystackCallbackUrl,
  isAllowedPaystackCallbackUrl,
  paystackCallbackUrlError,
} from '@/lib/paystack/callbackUrl';
import { invokePaystackInitialize } from '@/lib/paystack/invokePaystackInitialize';
import { openPaystackCheckoutInBrowser } from '@/lib/paystack/openPaystackBrowser';
import type { PremiumTier } from '@/lib/premium/catalog';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function openPremiumPaystackCheckout(opts: {
  email: string;
  userId: string;
  tier: PremiumTier;
}): Promise<{ ok: boolean; error?: string; reference: string }> {
  if (!opts.email?.trim()) {
    return { ok: false, error: 'Add an email to your account.', reference: '' };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase is not configured. Premium checkout requires paystack-initialize on the server.',
      reference: '',
    };
  }

  const callbackUrl = getPremiumPaystackCallbackUrl();
  if (!isAllowedPaystackCallbackUrl(callbackUrl)) {
    return { ok: false, error: paystackCallbackUrlError(), reference: '' };
  }

  const init = await invokePaystackInitialize({
    kind: 'premium',
    email: opts.email.trim(),
    callback_url: callbackUrl,
    tier_id: opts.tier.id,
  });

  if (!init.ok) {
    return { ok: false, error: init.error, reference: '' };
  }

  const opened = await openPaystackCheckoutInBrowser(init.data.authorization_url, callbackUrl);
  if (!opened.ok) {
    return { ok: false, error: opened.error, reference: init.data.reference };
  }

  return { ok: true, reference: init.data.reference };
}
