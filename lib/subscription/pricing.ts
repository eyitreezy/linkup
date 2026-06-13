/** Client display pricing — amounts resolved server-side at checkout. */

export const PRICING = {
  SILVER: {
    monthly: { amount_ngn: 1000, label: 'NGN 1,000/month' },
    annual: { amount_ngn: 10000, label: 'NGN 10,000/year', saving: 'Save 2 months' },
  },
  GOLD: {
    monthly: { amount_ngn: 1500, label: 'NGN 1,500/month' },
    annual: { amount_ngn: 15000, label: 'NGN 15,000/year', saving: 'Save 3 months' },
  },
  PLATINUM: {
    monthly: { amount_ngn: 3000, label: 'NGN 3,000/month' },
    annual: { amount_ngn: 30000, label: 'NGN 30,000/year', saving: 'Save 6 months' },
  },
} as const;

export type SubscriptionTier = 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type PaidTier = 'SILVER' | 'GOLD' | 'PLATINUM';
export type BillingCycle = 'monthly' | 'annual';

export const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  FREE: [
    'Host mutual & mood plans',
    'Standard discover filters',
    'Basic messaging',
    'Escrow Pattern A',
  ],
  SILVER: [
    'Advanced filters & bookmarks',
    'Read receipts',
    '4× 24hr boosts / month',
    '3 spotlights / month',
    'Wider discover radius',
    'Extended plan active window (14 days)',
  ],
  GOLD: [
    'Host group plans',
    'Travel mode & undo swipe',
    'Extend mood plans',
    'See all plan likes',
    '8 boosts + 1× 72hr boost',
  ],
  PLATINUM: [
    'Incognito browse & privacy tools',
    'Multi-city group plans',
    'Unlimited boosts & spotlights',
    'Longest active window (30 days)',
    'High-value escrow',
    'Concierge support',
  ],
};
