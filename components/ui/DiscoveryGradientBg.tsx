import { colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

/** Inbox / agreement / escrow screens — soft discovery gradient. */
export function DiscoveryGradientBg() {
  return (
    <LinearGradient
      colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
      locations={[0, 0.32, 0.62, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}
