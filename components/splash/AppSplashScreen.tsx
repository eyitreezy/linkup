/**
 * Branded cold-start splash — logo mark, wordmark, and product tagline.
 */
import {
  APP_NAME,
  APP_TAGLINE,
  APP_TAGLINE_SECONDARY,
} from '@/constants/brand';
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SplashDot({ delay }: { delay: number }) {
  return (
    <MotiView
      from={{ opacity: 0.35, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'timing',
        duration: 700,
        loop: true,
        repeatReverse: true,
        delay,
      }}
      style={styles.dot}
    />
  );
}

export function AppSplashScreen() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#2D1B4E', '#4A3F9F', colors.primary, '#8B5CF6', colors.secondary]}
      locations={[0, 0.28, 0.55, 0.78, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <View style={[styles.glowOrb, styles.glowOrbTop]} />
      <View style={[styles.glowOrb, styles.glowOrbBottom]} />

      <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 }]}>
        <MotiView
          from={{ opacity: 0, scale: 0.88, translateY: 18 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 720 }}
          style={styles.logoWrap}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoRing}
          >
            <LinearGradient
              colors={[colors.primary, '#8B7CE8', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Ionicons name="people" size={42} color="#FFFFFF" />
            </LinearGradient>
          </LinearGradient>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 680, delay: 120 }}
          style={styles.wordmarkBlock}
        >
          <Text style={styles.wordmark} accessibilityRole="header">
            {APP_NAME}
          </Text>
          <View style={styles.wordmarkRule} />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 640, delay: 260 }}
          style={styles.taglineBlock}
        >
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
          <Text style={styles.taglineSecondary}>{APP_TAGLINE_SECONDARY}</Text>
        </MotiView>
      </View>

      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 500, delay: 420 }}
        style={[styles.dotsRow, { bottom: insets.bottom + 28 }]}
      >
        <SplashDot delay={0} />
        <SplashDot delay={180} />
        <SplashDot delay={360} />
      </MotiView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glowOrbTop: {
    width: 280,
    height: 280,
    top: -80,
    right: -60,
  },
  glowOrbBottom: {
    width: 220,
    height: 220,
    bottom: 120,
    left: -70,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    marginBottom: 28,
  },
  logoRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  logoBadge: {
    width: '100%',
    height: '100%',
    borderRadius: 61,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  wordmarkBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  wordmark: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  wordmarkRule: {
    marginTop: 12,
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  taglineBlock: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 300,
  },
  tagline: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    textAlign: 'center',
    letterSpacing: -0.25,
  },
  taglineSecondary: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    letterSpacing: -0.15,
  },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
});
