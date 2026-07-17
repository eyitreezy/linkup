/**
 * Solid branded splash backdrop.
 */
import { APP_SPLASH_BACKGROUND } from '@/constants/brand';
import { StyleSheet, View } from 'react-native';

export function SplashBackground({ children }: { children?: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: APP_SPLASH_BACKGROUND,
  },
});
