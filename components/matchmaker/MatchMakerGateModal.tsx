import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MM, MM_CTA_GRADIENT, MM_CTA_GRADIENT_LOCATIONS } from '@/constants/matchmakerTheme';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type MatchMakerGateState = 'subscription' | 'kyc' | 'cooldown' | 'suspended';

type Props = {
  visible: boolean;
  gate: MatchMakerGateState;
  cooldownDaysRemaining?: number;
  cooldownUntil?: string;
  suspensionDaysRemaining?: number;
  onDismiss?: () => void;
};

export function MatchMakerGateModal({
  visible,
  gate,
  cooldownDaysRemaining = 0,
  cooldownUntil,
  suspensionDaysRemaining = 0,
  onDismiss,
}: Props) {
  const config = {
    subscription: {
      icon: <MatchMakerTabIcon size={48} color={MM.accent} active />,
      heading: 'MatchMaker is a Gold feature and above',
      body: 'Upgrade to Gold or a subscription plan higher than Gold to access intentional matchmaking designed for people serious about finding a long-term relationship.',
      cta: 'Upgrade to Gold',
      ctaType: 'gradient' as const,
      onCta: () => router.push('/subscription' as Href),
    },
    kyc: {
      icon: <Ionicons name="shield-checkmark" size={48} color={MM.primary} />,
      heading: 'Verify your identity first',
      body: 'MatchMaker requires identity verification before you enter the pool, to protect you and every other member.',
      cta: 'Complete verification',
      ctaType: 'gradient' as const,
      onCta: () => router.push('/kyc' as Href),
    },
    cooldown: {
      icon: <Ionicons name="time-outline" size={48} color={MM.muted} />,
      heading: `MatchMaker is paused for ${cooldownDaysRemaining} day${cooldownDaysRemaining === 1 ? '' : 's'}`,
      body: cooldownUntil
        ? `MatchMaker is built for intentional connections. Your access resumes on ${new Date(cooldownUntil).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : 'MatchMaker is built for intentional connections. Your access will resume soon.',
      cta: 'Got it',
      ctaType: 'secondary' as const,
      onCta: onDismiss,
    },
    suspended: {
      icon: <Ionicons name="warning-outline" size={48} color={MM.accent} />,
      heading: 'MatchMaker access suspended',
      body: `Your MatchMaker access is suspended for ${suspensionDaysRemaining} day${suspensionDaysRemaining === 1 ? '' : 's'} due to a contact-sharing policy violation. All other LinkUp features remain accessible.`,
      cta: 'Got it',
      ctaType: 'secondary' as const,
      onCta: onDismiss,
    },
  }[gate];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        /* non-closeable */
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>{config.icon}</View>
          <Text style={styles.heading}>{config.heading}</Text>
          <Text style={styles.body}>{config.body}</Text>

          {config.ctaType === 'gradient' ? (
            <LinearGradient
              colors={[...MM_CTA_GRADIENT]}
              locations={[...MM_CTA_GRADIENT_LOCATIONS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Pressable
                onPress={config.onCta}
                style={({ pressed }) => [styles.ctaInner, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
              >
                <Text style={styles.ctaTextGradient}>{config.cta}</Text>
              </Pressable>
            </LinearGradient>
          ) : (
            <Pressable
              onPress={config.onCta}
              style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
            >
              <Text style={styles.ctaTextSecondary}>{config.cta}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: MM.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#2A1F55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
  },
  iconWrap: { marginTop: spacing.sm, marginBottom: spacing.xs },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: MM.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: MM.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaGradient: { width: '100%', borderRadius: radius.button, marginTop: spacing.xs },
  ctaInner: { height: 52, alignItems: 'center', justifyContent: 'center' },
  ctaTextGradient: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  ctaSecondary: {
    width: '100%',
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: MM.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  ctaTextSecondary: { fontFamily: fonts.bold, fontSize: 15, color: MM.text },
});
