/**
 * Centered splash lockup — linkup wordmark image + Poppins tagline + rule.
 * Layout matches linkup-web SplashBrandLockup (responsive logo width + text-fit rule).
 */
import { APP_SPLASH_TAGLINE, APP_SPLASH_TAGLINE_COLOR, APP_NAME } from '@/constants/brand';
import { getSplashLockupMetrics } from '@/constants/splashLockup';
import { Poppins_500Medium } from '@expo-google-fonts/poppins';
import { Image } from 'expo-image';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

type Props = {
  logoWidth?: number;
};

export function SplashBrandLockup({ logoWidth: logoWidthProp }: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const { logoWidth, logoHeight, taglineInset } = getSplashLockupMetrics(
    viewportWidth,
    logoWidthProp
  );

  return (
    <View style={styles.root} accessibilityRole="header" accessibilityLabel={APP_NAME}>
      <Image
        source={require('@/assets/splash-brand-logo.png')}
        style={{ width: logoWidth, height: logoHeight }}
        contentFit="contain"
        priority="high"
        allowDownscaling={false}
        accessibilityIgnoresInvertColors
      />

      <View style={[styles.taglineBlock, { marginLeft: taglineInset }]}>
        <Text style={styles.tagline} numberOfLines={1}>
          {APP_SPLASH_TAGLINE}
        </Text>
        <View style={styles.taglineRule} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-start',
    maxWidth: '100%',
  },
  taglineBlock: {
    marginTop: -4,
    alignSelf: 'flex-start',
  },
  tagline: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: Poppins_500Medium,
    color: APP_SPLASH_TAGLINE_COLOR,
    letterSpacing: 0.15,
    flexShrink: 0,
  },
  taglineRule: {
    marginTop: 6,
    height: 2,
    alignSelf: 'stretch',
    borderRadius: 999,
    backgroundColor: APP_SPLASH_TAGLINE_COLOR,
    opacity: 1,
  },
});
