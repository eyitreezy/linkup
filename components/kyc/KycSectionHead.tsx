import { kycInboxStyles } from '@/components/kyc/kycTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

type Props = {
  title: string;
};

export function KycSectionHead({ title }: Props) {
  return (
    <View style={kycInboxStyles.sectionHead}>
      <View style={kycInboxStyles.sectionHeadRow}>
        <View style={kycInboxStyles.sectionDot} />
        <Text style={kycInboxStyles.sectionTitle}>{title}</Text>
      </View>
      <LinearGradient
        colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={kycInboxStyles.sectionRule}
      />
    </View>
  );
}
