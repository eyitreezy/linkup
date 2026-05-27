/**
 * KYC wizard shell — inbox gradient, glass nav, progress (shared across steps).
 */
import { KycProgressBar } from '@/components/kyc/KycProgressBar';
import { kycInboxStyles } from '@/components/kyc/kycTheme';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  step: number;
  onClose: () => void;
  children: ReactNode;
  /** Hide step bar on terminal states (optional). */
  showProgress?: boolean;
  badgeLabel?: string;
};

export function KycShell({
  step,
  onClose,
  children,
  showProgress = true,
  badgeLabel = 'Verification',
}: Props) {
  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={kycInboxStyles.screenRoot}>
      <View style={kycInboxStyles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={kycInboxStyles.topNav}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [kycInboxStyles.iconPill, pressed && kycInboxStyles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close verification"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={kycInboxStyles.topNavBadge}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
            <Text style={kycInboxStyles.topNavBadgeText}>{badgeLabel}</Text>
          </View>
        </View>

        {showProgress ? <KycProgressBar step={step} /> : null}

        <View style={kycInboxStyles.body}>{children}</View>
      </View>
    </Screen>
  );
}
