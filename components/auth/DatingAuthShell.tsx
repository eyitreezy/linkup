/**
 * Hero gradient + form sheet: sheet overlaps the gradient slightly so no white “seam” appears;
 * hero padding keeps copy above the overlap. Includes mount entrance motion.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Row below the form sheet (e.g. sign up / log in link) */
  belowCard?: ReactNode;
};

const gradientColors = [colors.authGradientTop, colors.authGradientMid, colors.authGradientBottom] as const;

/**
 * Hero height: copy must sit above where the white sheet overlaps the gradient (~SHEET_OVERLAP).
 * The overlap removes the “white strip” seam (root bg showing between gradient + card).
 */
const SHEET_OVERLAP = 26;
const HERO_MIN_HEIGHT = 288;

const SPRING = {
  friction: 10,
  tension: 78,
  useNativeDriver: true as const,
};

function useMountEntrance() {
  const brand = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const subtitle = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(1)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(1)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeUp = (v: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      fadeUp(brand, 0),
      fadeUp(title, 90),
      fadeUp(subtitle, 180),
      Animated.sequence([
        Animated.delay(110),
        Animated.parallel([
          Animated.spring(sheetY, { ...SPRING, toValue: 0 }),
          Animated.timing(sheetOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(270),
        Animated.parallel([
          Animated.spring(formY, { ...SPRING, toValue: 0 }),
          Animated.timing(formOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [brand, title, subtitle, sheetY, sheetOpacity, formY, formOpacity]);

  const heroLineStyle = (v: Animated.Value) => ({
    opacity: v,
    transform: [
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  });

  const sheetStyle = {
    opacity: sheetOpacity,
    transform: [
      {
        translateY: sheetY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 44],
        }),
      },
    ],
  };

  const formStyle = {
    opacity: formOpacity,
    transform: [
      {
        translateY: formY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 18],
        }),
      },
    ],
  };

  return { brand, title, subtitle, heroLineStyle, sheetStyle, formStyle };
}

export function DatingAuthShell({ title, subtitle, children, belowCard }: Props) {
  const { brand, title: titleAnim, subtitle: subtitleAnim, heroLineStyle, sheetStyle, formStyle } =
    useMountEntrance();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.heroWrap} pointerEvents="box-none">
        <LinearGradient
          colors={[...gradientColors]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <SafeAreaView style={styles.safeTop} edges={['top']}>
          <View style={styles.hero}>
            <Animated.View style={heroLineStyle(brand)}>
              <Text style={styles.brand}>LinkUp</Text>
            </Animated.View>
            <Animated.View style={heroLineStyle(titleAnim)}>
              <Text style={styles.title}>{title}</Text>
            </Animated.View>
            <Animated.View style={heroLineStyle(subtitleAnim)}>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.card, formStyle]}>
              {children}
            </Animated.View>
            {belowCard ? (
              <Animated.View style={[styles.below, formStyle]}>
                {belowCard}
              </Animated.View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.authCard,
  },
  heroWrap: {
    minHeight: HERO_MIN_HEIGHT,
    flexShrink: 0,
    position: 'relative',
    zIndex: 0,
    overflow: 'hidden',
  },
  safeTop: {
    flex: 1,
  },
  hero: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    /** Extra bottom space so subtitle stays above the sheet curve (sheet overlaps gradient below). */
    paddingBottom: spacing.xl + spacing.sm,
    justifyContent: 'flex-start',
    minHeight: HERO_MIN_HEIGHT - 4,
  },
  brand: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.92)',
    maxWidth: 340,
  },
  /**
   * Pulls up over the gradient so there is no gap (no root white showing between blocks).
   * Higher z-index + elevation paint the rounded sheet on top of the hero edge.
   */
  sheet: {
    flex: 1,
    backgroundColor: colors.authCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: -SHEET_OVERLAP,
    paddingTop: spacing.lg + 4,
    zIndex: 2,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  below: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  card: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
});
