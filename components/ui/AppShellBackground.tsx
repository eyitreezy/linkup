/**
 * Full-bleed app shell backdrop — matches splash / screen background on all routes.
 */
import { colors } from '@/constants/theme';
import { useFullBleedAbsoluteFillStyle } from '@/hooks/useFullBleedAbsoluteFillStyle';
import { StyleSheet, View } from 'react-native';

export function AppShellBackground() {
  const bleedStyle = useFullBleedAbsoluteFillStyle();
  return <View style={[bleedStyle, styles.bg]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.splashBackground },
});
