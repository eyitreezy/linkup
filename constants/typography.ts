/**
 * LinkUp typography roles — fontFamily from loaded Plus Jakarta Sans variants.
 * @see docs/APP-FONTS.md
 */
import { fonts } from '@/constants/theme';
import type { TextStyle } from 'react-native';

type FontWeightToken = TextStyle['fontWeight'];

function weightNumber(weight: FontWeightToken | undefined): number {
  if (weight == null) return 400;
  if (typeof weight === 'number') return weight;
  const named: Record<string, number> = {
    normal: 400,
    bold: 700,
    '100': 100,
    '200': 200,
    '300': 300,
    '400': 400,
    '500': 500,
    '600': 600,
    '700': 700,
    '800': 800,
    '900': 900,
  };
  return named[weight] ?? 400;
}

/** Map RN fontWeight to the correct loaded Plus Jakarta Sans file. */
export function fontFamilyForWeight(weight: FontWeightToken | undefined): string {
  const n = weightNumber(weight);
  if (n >= 800) return fonts.bold;
  if (n >= 600) return fonts.medium;
  return fonts.regular;
}

/** Preset roles from docs/APP-FONTS.md — spread into StyleSheet entries. */
export const typography = {
  display: {
    fontFamily: fonts.bold,
    fontWeight: '900' as const,
    letterSpacing: -0.6,
  },
  headline: {
    fontFamily: fonts.bold,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: fonts.medium,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  body: {
    fontFamily: fonts.regular,
    fontWeight: '400' as const,
    letterSpacing: -0.15,
  },
  bodyEmphasis: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
  },
  caption: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  captionStrong: {
    fontFamily: fonts.bold,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
} as const;
