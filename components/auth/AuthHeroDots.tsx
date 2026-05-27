import { AUTH_CARD_MARGIN_H } from '@/components/auth/authLayout';
import { useAuthHero } from '@/components/auth/AuthHeroContext';
import { spacing } from '@/constants/theme';
import { Pressable, StyleSheet, View } from 'react-native';

export function AuthHeroDots() {
  const { slides, slideIndex, fadeToSlide } = useAuthHero();
  if (slides.length < 2) return null;

  return (
    <View style={styles.wrap}>
      {slides.map((_, i) => (
        <Pressable
          key={i}
          onPress={() => fadeToSlide(i)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Slide ${i + 1}`}
          accessibilityState={{ selected: i === slideIndex }}
          style={({ pressed }) => [styles.hit, pressed && styles.hitPressed]}
        >
          <View style={[styles.dot, i === slideIndex ? styles.dotActive : styles.dotIdle]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.md,
    marginHorizontal: AUTH_CARD_MARGIN_H,
  },
  hit: { padding: 4 },
  hitPressed: { opacity: 0.75 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 26, backgroundColor: '#FFFFFF' },
  dotIdle: { width: 7, backgroundColor: 'rgba(255,255,255,0.38)' },
});
