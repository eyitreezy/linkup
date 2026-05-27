/**
 * Editorial slide headline — positioned above the auth glass card.
 */
import { AUTH_CARD_MARGIN_H, AUTH_CARD_PADDING_H } from '@/components/auth/authLayout';
import { useAuthHero } from '@/components/auth/AuthHeroContext';
import { spacing } from '@/constants/theme';
import { Animated, StyleSheet, Text, View } from 'react-native';

export function AuthHeroCopy() {
  const { slides, slideOpacities } = useAuthHero();

  return (
    <View style={styles.wrap} pointerEvents="none">
      {slides.map((slide, i) => (
        <Animated.View
          key={slide.headline}
          style={[styles.layer, { opacity: slideOpacities[i] }]}
        >
          <Text
            style={styles.headline}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {slide.headline}
          </Text>
          <Text style={styles.subtext} numberOfLines={2}>
            {slide.subtext}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 88,
    marginBottom: spacing.md,
    marginHorizontal: AUTH_CARD_MARGIN_H,
    paddingHorizontal: AUTH_CARD_PADDING_H,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    lineHeight: 34,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 16,
  },
  subtext: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
});
