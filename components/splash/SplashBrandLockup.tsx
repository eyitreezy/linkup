/**
 * Centered splash lockup — transparent wordmark + tagline image.
 */
import { APP_NAME, FLOWDECK_ATTRIBUTION } from '@/constants/brand';
import { getSplashLockupMetrics } from '@/constants/splashLockup';
import { fonts } from '@/constants/theme';
import { Image } from 'expo-image';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
      <Text style={styles.flowdeckTxt}>{FLOWDECK_ATTRIBUTION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    maxWidth: '100%',
  },
  flowdeckTxt: {
    marginTop: 16,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.medium,
    fontStyle: 'italic',
    color: 'rgba(139, 90, 90, 0.60)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
