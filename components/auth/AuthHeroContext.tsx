import type { AuthHeroSlide } from '@/lib/auth/datingAuthHeroSlides';
import { createContext, useContext } from 'react';
import type { Animated } from 'react-native';

export type AuthHeroContextValue = {
  slides: AuthHeroSlide[];
  slideIndex: number;
  slideOpacities: Animated.Value[];
  fadeToSlide: (index: number) => void;
};

export const AuthHeroContext = createContext<AuthHeroContextValue | null>(null);

export function useAuthHero() {
  const ctx = useContext(AuthHeroContext);
  if (!ctx) throw new Error('useAuthHero must be used within AuthHeroProvider');
  return ctx;
}
