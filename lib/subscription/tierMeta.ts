import type { SubscriptionTier } from '@/lib/subscription/pricing';

export type TierMeta = {
  label: string;
  badgeBg: string;
  badgeText: string;
  innerBg: [string, string, string];
  borderGradient: [string, string, string];
  iconGradient: [string, string];
  ctaGradient: [string, string];
};

export const TIER_META: Record<SubscriptionTier, TierMeta> = {
  FREE: {
    label: 'Free Explorer',
    badgeBg: '#EDE8FF',
    badgeText: '#5E52FF',
    innerBg: ['#FFFFFF', '#F8F4FF', '#FFF5F8'],
    borderGradient: ['#5E52FF', '#8B7CFF', '#FF4A72'],
    iconGradient: ['#5E52FF', '#FF4A72'],
    ctaGradient: ['#5E52FF', '#FF4A72'],
  },
  SILVER: {
    label: 'Silver Explorer',
    badgeBg: '#E5E7EB',
    badgeText: '#475569',
    innerBg: ['#F8FAFC', '#FFFFFF', '#F8F4FF'],
    borderGradient: ['#CBD5E1', '#E2E8F0', 'rgba(94, 82, 255, 0.35)'],
    iconGradient: ['#5E52FF', '#FF4A72'],
    ctaGradient: ['#5E52FF', '#FF4A72'],
  },
  GOLD: {
    label: 'Gold Explorer',
    badgeBg: '#FEF3C7',
    badgeText: '#B45309',
    innerBg: ['#FFFBEB', '#FFFFFF', '#FFF7ED'],
    borderGradient: ['#FBBF24', '#F59E0B', '#FB923C'],
    iconGradient: ['#F59E0B', '#EA580C'],
    ctaGradient: ['#F59E0B', '#EA580C'],
  },
  PLATINUM: {
    label: 'Platinum Explorer',
    badgeBg: '#EDE7F6',
    badgeText: '#6D28D9',
    innerBg: ['#F5F3FF', '#FFFFFF', '#FFF5F8'],
    borderGradient: ['#A78BFA', '#5E52FF', '#FF4A72'],
    iconGradient: ['#5E52FF', '#FF4A72'],
    ctaGradient: ['#5E52FF', '#FF4A72'],
  },
};

export const TIER_UPGRADE_BULLETS: Record<Exclude<SubscriptionTier, 'FREE'>, string[]> = {
  SILVER: ['Advanced filters', 'Bookmark plans', 'Read receipts', 'Plan Boosts'],
  GOLD: ['Group Plan hosting', 'Travel Mode', 'See all likes', 'Undo swipe'],
  PLATINUM: ['Incognito browsing', 'Unlimited boosts', 'Concierge support', 'Multi-city plans'],
};

export function formatNgn(amount: number): string {
  return `NGN ${amount.toLocaleString('en-NG')}`;
}

export function tierShortBadge(tier: Exclude<SubscriptionTier, 'FREE'>): string {
  if (tier === 'SILVER') return 'Silver';
  if (tier === 'GOLD') return 'Gold';
  return 'Platinum';
}
