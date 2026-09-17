import { fonts, radius, spacing } from '@/constants/theme';

export const MM = {
  primary: '#6C63FF',
  accent: '#9B1B4B',
  bg: '#FDF8F4',
  surface: '#FFFFFF',
  surfaceWarm: '#FBF5F0',
  border: '#EDE0D4',
  text: '#1A1D26',
  muted: '#7B6E65',
  disabled: '#C8BDB8',
  tabActive: '#9B1B4B',
  tabInactive: '#C8BDB8',
} as const;

export const MM_CTA_GRADIENT = ['#5E52FF', '#8B84FF', '#9B1B4B'] as const;
export const MM_CTA_GRADIENT_LOCATIONS = [0, 0.5, 1] as const;

export const MM_SCREEN_EASING = { x1: 0.25, y1: 0.46, x2: 0.45, y2: 0.94 } as const;

export { fonts, radius, spacing };
