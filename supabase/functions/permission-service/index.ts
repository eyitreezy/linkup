/**
 * Central permission gate — all tier checks must go through this function.
 *
 * POST { user_id, feature, check_quota?: boolean }
 */
import { corsHeaders, handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import {
  BOOST_QUOTA,
  currentMonthYear,
  isFeatureAllowed,
  minTierForFeature,
  resolveEffectiveTier,
  tierMetadata,
  type EffectiveTier,
} from '../_shared/permissions.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type Body = {
  user_id?: string;
  feature?: string;
  check_quota?: boolean;
};

function quotaFeatureKey(feature: string): 'boosts_24hr' | 'boosts_72hr' | 'spotlights' | null {
  if (feature === 'boost.24hr' || feature === 'boost.unlimited') return 'boosts_24hr';
  if (feature === 'boost.72hr') return 'boosts_72hr';
  if (feature === 'spotlight.profile' || feature === 'spotlight.unlimited') return 'spotlights';
  return null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const userId = body.user_id;
  const feature = body.feature;
  if (!userId || !feature) {
    return jsonError('user_id and feature are required', 400);
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error(e);
    return jsonError('Server misconfigured', 500);
  }

  const { data: user, error } = await supabase
    .from('users')
    .select(
      'subscription_tier, subscription_expires_at, silver_trial_expires_at, gold_trial_expires_at, has_been_silver_subscriber'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return jsonError('User not found', 404);
  }

  const effectiveTier = resolveEffectiveTier(user);
  const allowed = isFeatureAllowed(feature, effectiveTier);
  const metadata = tierMetadata(effectiveTier, feature);

  if (!allowed) {
    const upgradeTo = minTierForFeature(feature);
    return jsonResponse({
      allowed: false,
      effective_tier: effectiveTier,
      reason: upgradeTo ? `Feature requires ${upgradeTo} or above` : 'Feature not available',
      upgrade_to: upgradeTo,
      metadata,
    });
  }

  if (body.check_quota && effectiveTier !== 'PLATINUM') {
    const quotaKey = quotaFeatureKey(feature);
    if (quotaKey) {
      const limits = BOOST_QUOTA[effectiveTier];
      const limitField =
        quotaKey === 'boosts_24hr'
          ? limits.boosts_24hr_monthly
          : quotaKey === 'boosts_72hr'
            ? limits.boosts_72hr_monthly
            : limits.spotlights_monthly;

      if (limitField === 0) {
        const upgradeTo: EffectiveTier = feature.includes('72') ? 'GOLD' : 'SILVER';
        return jsonResponse({
          allowed: false,
          effective_tier: effectiveTier,
          reason: `Monthly ${quotaKey.replace('_', ' ')} quota exhausted for ${effectiveTier}`,
          upgrade_to: upgradeTo,
          metadata,
        });
      }

      if (limitField > 0) {
        const monthYear = currentMonthYear();
        const usedField =
          quotaKey === 'boosts_24hr'
            ? 'boosts_24hr_used'
            : quotaKey === 'boosts_72hr'
              ? 'boosts_72hr_used'
              : 'spotlights_used';

        const { data: quota } = await supabase
          .from('boost_quota')
          .select('boosts_24hr_used, boosts_72hr_used, spotlights_used')
          .eq('user_id', userId)
          .eq('month_year', monthYear)
          .maybeSingle();

        const used = (quota?.[usedField] as number | undefined) ?? 0;
        if (used >= limitField) {
          const upgradeTo: EffectiveTier =
            effectiveTier === 'SILVER' && quotaKey === 'boosts_72hr' ? 'GOLD' : 'PLATINUM';
          return jsonResponse({
            allowed: false,
            effective_tier: effectiveTier,
            reason: `Monthly quota reached (${used}/${limitField})`,
            upgrade_to: upgradeTo,
            metadata: { ...metadata, quota_used: used, quota_limit: limitField },
          });
        }
        metadata.quota_used = used;
        metadata.quota_limit = limitField;
      }
    }
  }

  return jsonResponse({
    allowed: true,
    effective_tier: effectiveTier,
    metadata,
  });
});
