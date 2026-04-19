import type { SupabaseClient } from '@supabase/supabase-js';
import type { PremiumTier } from '@/lib/premium/catalog';

/**
 * Demo / client-side fulfillment after Paystack success (dev & simulator only).
 * Production: entitlement updates must run only from `paystack-webhook-premium` after `charge.success`.
 */
export async function applyPremiumPurchase(
  client: SupabaseClient,
  userId: string,
  tier: PremiumTier
): Promise<{ error: string | null }> {
  const until = new Date();
  until.setDate(until.getDate() + tier.durationDays);

  const { data: row, error: readErr } = await client.from('users').select('boost_credits').eq('id', userId).single();
  if (readErr) return { error: readErr.message };

  const current = typeof row?.boost_credits === 'number' ? row.boost_credits : 0;
  const nextCredits = current + tier.bonusBoostCredits;

  const { error } = await client
    .from('users')
    .update({
      premium_until: until.toISOString(),
      subscription_status: 'active',
      boost_credits: nextCredits,
    })
    .eq('id', userId);

  return { error: error?.message ?? null };
}
