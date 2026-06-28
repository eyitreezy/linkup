import {
  DISCOVERY_SHELL_GRADIENT,
  DISCOVERY_SHELL_GRADIENT_LOCATIONS,
} from '@/constants/gradients';
import { useFullBleedAbsoluteFillStyle } from '@/hooks/useFullBleedAbsoluteFillStyle';
import { LinearGradient } from 'expo-linear-gradient';

/** Inbox / agreement / escrow screens — soft discovery gradient. */
export function DiscoveryGradientBg() {
  const bleedStyle = useFullBleedAbsoluteFillStyle();
  return (
    <LinearGradient
      colors={[...DISCOVERY_SHELL_GRADIENT]}
      locations={[...DISCOVERY_SHELL_GRADIENT_LOCATIONS]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={bleedStyle}
      pointerEvents="none"
    />
  );
}
