/**
 * Centered splash lockup — transparent wordmark + tagline image.
 */
import { APP_NAME } from '@/constants/brand';
import { getSplashLockupMetrics } from '@/constants/splashLockup';
import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

type Props = {
  lockupWidth?: number;
};

export function SplashBrandLockup({ lockupWidth: lockupWidthProp }: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const { lockupWidth, lockupHeight } = getSplashLockupMetrics(viewportWidth, lockupWidthProp);

  return (
    <View style={styles.root} accessibilityRole="header" accessibilityLabel={APP_NAME}>
      <Image
        source={require('@/assets/splash-brand-lockup.png')}
        style={{ width: lockupWidth, height: lockupHeight }}
        contentFit="contain"
        priority="high"
        allowDownscaling={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    maxWidth: '100%',
  },
});
