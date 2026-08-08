/**
 * Branded cold-start splash — pastel backdrop + linkup lockup (mirrors linkup-web).
 */
import { SplashBackground } from '@/components/splash/SplashBackground';
import { SplashBrandLockup } from '@/components/splash/SplashBrandLockup';
import { FLOWDECK_ATTRIBUTION } from '@/constants/brand';
import { MotiView } from 'moti';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AppSplashScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SplashBackground>
      <View style={styles.content}>
        <MotiView
          from={{ opacity: 0, scale: 0.92, translateY: 16 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 720 }}
        >
          <SplashBrandLockup />
        </MotiView>
      </View>
      <Text style={[styles.attribution, { bottom: Math.max(insets.bottom + 12, 20) }]}>{FLOWDECK_ATTRIBUTION}</Text>
    </SplashBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
    paddingBottom: 96,
  },
  attribution: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: '#DC2626',
  },
});
