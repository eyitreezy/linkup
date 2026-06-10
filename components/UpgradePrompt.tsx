/**
 * Reusable tier upgrade prompt — motivating, never blocking tone.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { featureDisplayName, tierDisplayName } from '@/lib/subscription/featureLabels';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Ion = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  feature: string;
  requiredTier: SubscriptionTier;
  onUpgrade: () => void;
  onDismiss: () => void;
  /** Override default "Unlock {feature}" title. */
  title?: string;
  /** Override default tier message. */
  message?: string;
  icon?: Ion;
};

export function UpgradePrompt({
  visible,
  feature,
  requiredTier,
  onUpgrade,
  onDismiss,
  title,
  message,
  icon = 'sparkles-outline',
}: Props) {
  const featureName = featureDisplayName(feature);
  const tierName = tierDisplayName(requiredTier);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.45)', 'rgba(255,101,132,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            <View style={styles.card}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGrad}
              >
                <Ionicons name={icon} size={28} color="#fff" />
              </LinearGradient>

              <Text style={styles.title}>{title ?? `Unlock ${featureName}`}</Text>
              <Text style={styles.message}>
                {message ?? `This feature is available on ${tierName} and above.`}
              </Text>

              <Pressable
                onPress={onUpgrade}
                style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Upgrade to ${tierName}`}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGrad}
                >
                  <Text style={styles.ctaTxt}>Upgrade to {tierName}</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="Not now"
              >
                <Text style={styles.secondaryTxt}>Not now</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 29, 38, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheetHit: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  ring: { borderRadius: radius.xl + 2, padding: 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  iconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  ctaOuter: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 14 },
      android: { elevation: 4 },
    }),
  },
  ctaPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  ctaGrad: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  ctaTxt: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  secondaryBtn: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryTxt: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
