import { colors } from '@/constants/theme';
import type { DbMeetType } from '@/types/database';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type MeetTypeIonIcon = ComponentProps<typeof Ionicons>['name'];

const SLUG_GRADIENTS: Record<string, readonly [string, string]> = {
  mood: ['#FF4A72', '#FF9A76'],
  dinner: ['#5E52FF', '#A78BFA'],
  casual: ['#34D399', '#6EE7B7'],
  gym: ['#F59E0B', '#FBBF24'],
  hangout: ['#3B82F6', '#60A5FA'],
  group: ['#8B5CF6', '#C084FC'],
};

const DEFAULT_GRADIENT: readonly [string, string] = [colors.primary, colors.secondary];

export function meetTypeGradient(type: Pick<DbMeetType, 'slug'>): readonly [string, string] {
  return SLUG_GRADIENTS[type.slug] ?? DEFAULT_GRADIENT;
}

export function meetTypeIconName(type: Pick<DbMeetType, 'icon'>): MeetTypeIonIcon {
  return (type.icon as MeetTypeIonIcon) ?? 'sparkles-outline';
}
