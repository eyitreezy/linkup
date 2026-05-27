import type { ImageSourcePropType } from 'react-native';

export type AuthHeroSlide = {
  source: ImageSourcePropType;
  headline: string;
  subtext: string;
};

/** Full-screen auth hero — value props for conversion-focused onboarding. */
export const DATING_AUTH_HERO_SLIDES: AuthHeroSlide[] = [
  {
    source: require('@/assets/auth-hero/slide-1.jpg'),
    headline: 'Trusted plans nearby',
    subtext: 'Discover real hangouts from verified people around you.',
  },
  {
    source: require('@/assets/auth-hero/slide-2.jpg'),
    headline: 'Negotiate with ease',
    subtext: 'Align on time, place, and vibe before you meet.',
  },
  {
    source: require('@/assets/auth-hero/slide-3.jpg'),
    headline: 'Safe escrow system',
    subtext: 'Commitment-backed plans that reduce flakes and build trust.',
  },
  {
    source: require('@/assets/auth-hero/slide-4.jpg'),
    headline: 'Meet with confidence',
    subtext: 'Verified users, secure plans, and real connections.',
  },
];
