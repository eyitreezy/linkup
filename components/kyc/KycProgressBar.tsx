import { Text, View } from 'react-native';
import { kycStyles } from '@/components/kyc/kycTheme';
import { KYC_TOTAL_STEPS } from '@/types/kyc';

type Props = { step: number };

export function KycProgressBar({ step }: Props) {
  const pct = Math.min(100, Math.max(0, (step / KYC_TOTAL_STEPS) * 100));
  return (
    <View style={kycStyles.progressWrap}>
      <Text style={kycStyles.progressLabel}>
        Step {step} of {KYC_TOTAL_STEPS}
      </Text>
      <View style={kycStyles.progressTrack}>
        <View style={[kycStyles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}
