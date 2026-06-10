import type { SubscriptionTier } from '@/lib/subscription/pricing';

const FEATURE_LABELS: Record<string, string> = {
  'plans.bookmark': 'Save plans',
  'discover.advanced_filters': 'Advanced filters',
  'discover.travel_mode': 'Travel mode',
  'discover.undo_swipe': 'Undo swipe',
  'messaging.read_receipts': 'Read receipts',
  'group_plan.host': 'Group plans',
  'mood_plan.extend': 'Extend mood plans',
  'plans.see_all_likes': 'See all likes',
  'boost.24hr': '24-hour boost',
  'boost.72hr': '72-hour boost',
  'spotlight.profile': 'Profile spotlight',
  'escrow.high_value': 'High-value escrow',
  'escrow.pattern_b': 'Split escrow',
  'escrow.pattern_c': 'Guest-funded escrow',
};

export function featureDisplayName(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature.replace(/\./g, ' ').replace(/_/g, ' ');
}

export function tierDisplayName(tier: SubscriptionTier): string {
  if (tier === 'FREE') return 'Free';
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}
