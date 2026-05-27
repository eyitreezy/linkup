/**
 * Inspiration hero — full-width photo slides with fade transitions (no dot pager).
 * Assets: `assets/create-plan-hero/*.jpg` (see `lib/plans/createPlanHeroSlides.ts`).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { CREATE_PLAN_HERO_SLIDES } from '@/lib/plans/createPlanHeroSlides';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const W = Dimensions.get('window').width;
const CARD_W = W - spacing.md * 2;
const INTERVAL_MS = 5200;
const FADE_OUT_MS = 340;
const FADE_IN_MS = 450;

export function CreatePlanHeroCarousel() {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const busy = useRef(false);

  const advance = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        busy.current = false;
        return;
      }
      setIndex((i) => (i + 1) % CREATE_PLAN_HERO_SLIDES.length);
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        busy.current = false;
      });
    });
  }, [opacity]);

  useEffect(() => {
    const id = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(id);
  }, [advance]);

  const item = CREATE_PLAN_HERO_SLIDES[index];

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Inspiration</Text>
      <View style={[styles.card, { width: CARD_W }]}>
        <Animated.View style={[styles.cardFill, { opacity }]}>
          <Image
            source={item.source}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            priority="high"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardInner}>
            <Ionicons name={item.icon} size={32} color="rgba(255,255,255,0.95)" />
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardCap}>{item.caption}</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
    width: '100%',
  },
  card: {
    height: 228,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  cardFill: {
    flex: 1,
  },
  cardInner: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: spacing.sm },
  cardCap: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '600',
  },
});
