/** Server-side subscription pricing — never trust client amounts. */

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

export type PaidTier = 'SILVER' | 'GOLD' | 'PLATINUM';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionTier = 'FREE' | PaidTier | 'PLATINUM';

export function tierPriceNgn(tier: PaidTier, cycle: BillingCycle): number {
  return PRICING[tier][cycle].amount_ngn;
}

export function calculateExpiry(billing_cycle: BillingCycle, from = new Date()): Date {
  const now = new Date(from);
  if (billing_cycle === 'monthly') {
    return new Date(now.setMonth(now.getMonth() + 1));
  }
  return new Date(now.setFullYear(now.getFullYear() + 1));
}
