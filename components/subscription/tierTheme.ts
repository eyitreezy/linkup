import { colors } from '@/constants/theme';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IonName = ComponentProps<typeof Ionicons>['name'];

export type TierTheme = {
  icon: IonName;
  ring: readonly [string, string];
  accent: string;
  tagline: string;
};

export const TIER_THEME: Record<SubscriptionTier, TierTheme> = {
  FREE: {
    icon: 'leaf-outline',
    ring: ['rgba(107,114,128,0.22)', 'rgba(107,114,128,0.1)'],
    accent: colors.textMuted,
    tagline: 'Essentials to meet up',
  },
  SILVER: {
    icon: 'shield-checkmark-outline',
    ring: ['rgba(192,197,206,0.55)', 'rgba(108,99,255,0.18)'],
    accent: '#6B7280',
    tagline: 'Boost visibility & filters',
  },
  GOLD: {
    icon: 'star',
    ring: ['rgba(245,158,11,0.5)', 'rgba(108,99,255,0.3)'],
    accent: '#D97706',
    tagline: 'Group plans & travel mode',
  },
  PLATINUM: {
    icon: 'diamond-outline',
    ring: ['rgba(124,77,255,0.45)', 'rgba(245,158,11,0.28)'],
    accent: '#7C4DFF',
    tagline: 'Privacy, reach & concierge',
  },
};
