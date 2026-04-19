import type { SupabaseClient } from '@supabase/supabase-js';
import { canBoostPlan, isPremiumSubscriber } from '@/lib/premium/access';
import type { DbUser } from '@/types/database';

const BOOST_HOURS = 2;

export async function activatePlanBoost(
  client: SupabaseClient,
  args: {
    planId: string;
    creatorId: string;
    boostCredits: number;
    premiumSubscriber: boolean;
  }
): Promise<{ error: string | null }> {
  const eligible = args.premiumSubscriber || args.boostCredits > 0;
  if (!eligible) return { error: 'Get Premium or boost credits to promote this plan.' };

  const until = new Date();
  until.setHours(until.getHours() + BOOST_HOURS);

  if (!args.premiumSubscriber) {
    const { error: e1 } = await client
      .from('users')
      .update({ boost_credits: args.boostCredits - 1 })
      .eq('id', args.creatorId)
      .eq('boost_credits', args.boostCredits);
    if (e1) return { error: e1.message };
  }

  const { error: e2 } = await client
    .from('plans')
    .update({ boosted_until: until.toISOString() })
    .eq('id', args.planId)
    .eq('creator_id', args.creatorId);

  return { error: e2?.message ?? null };
}

export function boostEligibilityFromUser(u: DbUser | null | undefined): {
  canBoost: boolean;
  premiumSubscriber: boolean;
  credits: number;
} {
  const premiumSubscriber = isPremiumSubscriber(u);
  const credits = u?.boost_credits ?? 0;
  return {
    canBoost: canBoostPlan(u),
    premiumSubscriber,
    credits,
  };
}
