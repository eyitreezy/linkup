/**
 * Branded cold-start splash — pastel backdrop + linkup lockup (mirrors linkup-web).
 */
import { SplashBackground } from '@/components/splash/SplashBackground';
import { SplashBrandLockup } from '@/components/splash/SplashBrandLockup';
import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AppSplashScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SplashBackground>
      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 48, 96) }]}>
        <MotiView
          from={{ opacity: 0, scale: 0.92, translateY: 16 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 720 }}
        >
          <SplashBrandLockup />
        </MotiView>
      </View>
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
  },
});
