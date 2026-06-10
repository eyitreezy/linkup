import type { SupabaseClient } from '@supabase/supabase-js';
import { hasBoostCredit } from '@/lib/premium/access';

const BOOST_HOURS_24 = 24;
const BOOST_HOURS_72 = 72;

export async function activatePlanBoost(
  client: SupabaseClient,
  args: {
    planId: string;
    creatorId: string;
    hours?: 24 | 72;
    useLegacyCredit?: boolean;
  }
): Promise<{ error: string | null }> {
  const hours = args.hours ?? 24;
  const until = new Date();
  until.setHours(until.getHours() + hours);

  if (args.useLegacyCredit) {
    const { data: uRow } = await client.from('users').select('boost_credits').eq('id', args.creatorId).maybeSingle();
    const credits = (uRow?.boost_credits as number) ?? 0;
    if (credits <= 0) return { error: 'No boost credits available.' };
    const { error: e1 } = await client
      .from('users')
      .update({ boost_credits: credits - 1 })
      .eq('id', args.creatorId)
      .eq('boost_credits', credits);
    if (e1) return { error: e1.message };
  } else {
    const kind = hours >= 72 ? 'boosts_72hr' : 'boosts_24hr';
    const { error: quotaErr } = await client.rpc('record_boost_usage', { p_kind: kind });
    if (quotaErr) return { error: quotaErr.message };
  }

  const { error: e2 } = await client
    .from('plans')
    .update({ boosted_until: until.toISOString(), spotlight_enabled: true })
    .eq('id', args.planId)
    .eq('creator_id', args.creatorId);

  return { error: e2?.message ?? null };
}

export function hasLegacyBoostCredit(u: { boost_credits?: number | null } | null | undefined): boolean {
  return hasBoostCredit(u as { boost_credits?: number | null });
}
