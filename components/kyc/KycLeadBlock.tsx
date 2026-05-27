/**
 * Inbox-style hero block for KYC steps.
 */
import { kycInboxStyles } from '@/components/kyc/kycTheme';
import { colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

type Props = {
  kicker: string;
  title: string;
  subtitle?: string;
};

export function KycLeadBlock({ kicker, title, subtitle }: Props) {
  return (
    <View style={kycInboxStyles.leadBlock}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={kycInboxStyles.leadAccent}
      />
      <View style={kycInboxStyles.leadTextCol}>
        <Text style={kycInboxStyles.leadKicker}>{kicker}</Text>
        <Text style={kycInboxStyles.leadTitle}>{title}</Text>
        {subtitle ? <Text style={kycInboxStyles.leadSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
