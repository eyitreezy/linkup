import { kycStyles } from '@/components/kyc/kycTheme';
import { colors } from '@/constants/theme';
import { KYC_TOTAL_STEPS } from '@/types/kyc';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

type Props = { step: number };

export function KycProgressBar({ step }: Props) {
  const pct = Math.min(100, Math.max(0, (step / KYC_TOTAL_STEPS) * 100));
  return (
    <View style={kycStyles.progressWrap}>
      <Text style={kycStyles.progressLabel}>
        Step {step} of {KYC_TOTAL_STEPS}
      </Text>
      <View style={kycStyles.progressTrack}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[kycStyles.progressFill, { width: `${pct}%` }]}
        />
      </View>
    </View>
  );
}
