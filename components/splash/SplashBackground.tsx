/**
 * Pastel splash backdrop — lavender → white → rose with soft orbs and line art (no image).
 * Tuned for device builds: higher chroma stops and stronger orb contrast vs. web preview.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

const SPLASH = {
  lavenderTop: '#C4B5FD',
  lilacMid: '#DDD6FE',
  brightCenter: '#FFFFFF',
  peachBottom: '#FFC9DC',
  roseBottom: '#FFA8C5',
  orbLavender: 'rgba(124, 92, 255, 0.48)',
  orbLavenderSoft: 'rgba(94, 82, 255, 0.32)',
  orbRose: 'rgba(255, 74, 114, 0.46)',
  orbRoseSoft: 'rgba(255, 74, 114, 0.24)',
  arcLavender: 'rgba(94, 82, 255, 0.22)',
  arcRose: 'rgba(255, 74, 114, 0.18)',
} as const;

function SplashOrb({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style: object;
}) {
  return (
    <View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function SplashArc({
  size,
  borderColor,
  style,
}: {
  size: number;
  borderColor: string;
  style: object;
}) {
  return (
    <View
      style={[
        styles.arc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor,
        },
        style,
      ]}
    />
  );
}

export function SplashBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[
          SPLASH.lavenderTop,
          SPLASH.lilacMid,
          SPLASH.brightCenter,
          SPLASH.peachBottom,
          SPLASH.roseBottom,
        ]}
        locations={[0, 0.22, 0.48, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.centerGlow} pointerEvents="none" />

      <SplashOrb size={320} color={SPLASH.orbLavender} style={styles.orbTopLeft} />
      <SplashOrb size={280} color={SPLASH.orbLavenderSoft} style={styles.orbTopRight} />
      <SplashOrb size={300} color={SPLASH.orbRose} style={styles.orbBottomRight} />
      <SplashOrb size={340} color={SPLASH.orbRoseSoft} style={styles.orbBottomLeft} />

      <SplashArc size={420} borderColor={SPLASH.arcLavender} style={styles.arcUpper} />
      <SplashArc size={360} borderColor={SPLASH.arcLavender} style={styles.arcMidLeft} />
      <SplashArc size={480} borderColor={SPLASH.arcRose} style={styles.arcLower} />
      <SplashArc size={300} borderColor={SPLASH.arcRose} style={styles.arcLowerRight} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: SPLASH.brightCenter,
  },
  centerGlow: {
    position: 'absolute',
    top: '28%',
    alignSelf: 'center',
    width: '92%',
    height: '32%',
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  orb: {
    position: 'absolute',
  },
  orbTopLeft: {
    top: -90,
    left: -110,
  },
  orbTopRight: {
    top: 40,
    right: -120,
  },
  orbBottomRight: {
    bottom: -40,
    right: -80,
  },
  orbBottomLeft: {
    bottom: 80,
    left: -140,
  },
  arc: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'transparent',
  },
  arcUpper: {
    top: -180,
    left: -60,
    transform: [{ rotate: '-18deg' }],
  },
  arcMidLeft: {
    top: '28%',
    left: -200,
    transform: [{ rotate: '12deg' }],
  },
  arcLower: {
    bottom: -220,
    right: -140,
    transform: [{ rotate: '-8deg' }],
  },
  arcLowerRight: {
    bottom: 120,
    right: -160,
    transform: [{ rotate: '22deg' }],
  },
});
