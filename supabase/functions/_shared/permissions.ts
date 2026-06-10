/** Central permission matrices — single source of truth for permission-service. */

export type EffectiveTier = 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export const TIER_RANK: Record<EffectiveTier, number> = {
  FREE: 0,
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3,
};

export const PERMISSIONS: Record<string, EffectiveTier[]> = {
  'mutual_plan.host': ['FREE', 'SILVER', 'GOLD', 'PLATINUM'],
  'mood_plan.activate': ['FREE', 'SILVER', 'GOLD', 'PLATINUM'],
  'group_plan.join_as_guest': ['FREE', 'SILVER', 'GOLD', 'PLATINUM'],
  'discover.standard_filters': ['FREE', 'SILVER', 'GOLD', 'PLATINUM'],
  'escrow.pattern_a': ['FREE', 'SILVER', 'GOLD', 'PLATINUM'],
  'messaging.basic': ['FREE', 'SILVER', 'GOLD', 'PLATINUM'],

  'discover.advanced_filters': ['SILVER', 'GOLD', 'PLATINUM'],
  'plans.bookmark': ['SILVER', 'GOLD', 'PLATINUM'],
  'messaging.read_receipts': ['SILVER', 'GOLD', 'PLATINUM'],
  'boost.24hr': ['SILVER', 'GOLD', 'PLATINUM'],
  'spotlight.profile': ['SILVER', 'GOLD', 'PLATINUM'],
  'escrow.pattern_b': ['SILVER', 'GOLD', 'PLATINUM'],
  'plan.extended_window': ['SILVER', 'GOLD', 'PLATINUM'],
  'discover.wider_radius': ['SILVER', 'GOLD', 'PLATINUM'],

  'group_plan.host': ['GOLD', 'PLATINUM'],
  'mood_plan.extend': ['GOLD', 'PLATINUM'],
  'discover.travel_mode': ['GOLD', 'PLATINUM'],
  'discover.undo_swipe': ['GOLD', 'PLATINUM'],
  'plans.see_all_likes': ['GOLD', 'PLATINUM'],
  'boost.72hr': ['GOLD', 'PLATINUM'],
  'escrow.pattern_c': ['GOLD', 'PLATINUM'],

  'privacy.incognito_browse': ['PLATINUM'],
  'privacy.profile_view': ['PLATINUM'],
  'privacy.plan_creation': ['PLATINUM'],
  'privacy.masked_activity': ['PLATINUM'],
  'group_plan.multi_city': ['PLATINUM'],
  'escrow.high_value': ['PLATINUM'],
  'boost.unlimited': ['PLATINUM'],
  'spotlight.unlimited': ['PLATINUM'],
  'concierge.support': ['PLATINUM'],
  'early_access.features': ['PLATINUM'],
};

export const MOOD_PLAN_RULES = {
  FREE: { window_hours: 24, cooldown_days: 14, reach: 'city', can_extend: false, max_extensions: 0 },
  SILVER: { window_hours: 36, cooldown_days: 5, reach: 'city_adjacent', can_extend: false, max_extensions: 0 },
  GOLD: { window_hours: 48, cooldown_days: 3, reach: 'city_widest', can_extend: true, max_extensions: 1 },
  PLATINUM: { window_hours: 48, cooldown_days: 0, reach: 'all_cities', can_extend: true, max_extensions: -1 },
} as const;

export const BOOST_QUOTA = {
  FREE: { boosts_24hr_monthly: 0, boosts_72hr_monthly: 0, spotlights_monthly: 0 },
  SILVER: { boosts_24hr_monthly: 4, boosts_72hr_monthly: 0, spotlights_monthly: 3 },
  GOLD: { boosts_24hr_monthly: 8, boosts_72hr_monthly: 1, spotlights_monthly: 10 },
  PLATINUM: { boosts_24hr_monthly: -1, boosts_72hr_monthly: -1, spotlights_monthly: -1 },
} as const;

export const GROUP_PLAN_CAPS = {
  GOLD: { max_free_guests: 5, max_premium_guests: -1 },
  PLATINUM: { max_free_guests: 10, max_premium_guests: -1 },
} as const;

export type UserTierRow = {
  subscription_tier: string;
  subscription_expires_at: string | null;
  silver_trial_expires_at: string | null;
  gold_trial_expires_at: string | null;
  has_been_silver_subscriber: boolean;
};

export function resolveEffectiveTier(user: UserTierRow, now = new Date()): EffectiveTier {
  const paid = user.subscription_tier as EffectiveTier;
  if (
    paid !== 'FREE' &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at).getTime() > now.getTime()
  ) {
    return paid;
  }

  if (
    user.silver_trial_expires_at &&
    new Date(user.silver_trial_expires_at).getTime() > now.getTime() &&
    user.subscription_tier === 'FREE'
  ) {
    return 'SILVER';
  }

  if (
    user.gold_trial_expires_at &&
    new Date(user.gold_trial_expires_at).getTime() > now.getTime() &&
    user.has_been_silver_subscriber
  ) {
    return 'GOLD';
  }

  return 'FREE';
}

export function minTierForFeature(feature: string): EffectiveTier | null {
  const allowed = PERMISSIONS[feature];
  if (!allowed?.length) return null;
  return allowed.reduce<EffectiveTier>((min, t) => (TIER_RANK[t] < TIER_RANK[min] ? t : min), allowed[0]);
}

export function isFeatureAllowed(feature: string, effectiveTier: EffectiveTier): boolean {
  const allowed = PERMISSIONS[feature];
  if (!allowed) return false;
  return allowed.includes(effectiveTier);
}

export function tierMetadata(effectiveTier: EffectiveTier, feature: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (feature.startsWith('mood_plan')) {
    meta.mood_plan_rules = MOOD_PLAN_RULES[effectiveTier];
  }
  if (feature.startsWith('boost.') || feature.startsWith('spotlight.')) {
    meta.boost_quota = BOOST_QUOTA[effectiveTier];
  }
  if (feature.startsWith('group_plan')) {
    if (effectiveTier === 'GOLD' || effectiveTier === 'PLATINUM') {
      meta.group_plan_caps = GROUP_PLAN_CAPS[effectiveTier];
    }
  }
  return meta;
}

export function currentMonthYear(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
