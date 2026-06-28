/**
 * Centred upsell / upgrade gate — matches SilverTrialWelcomeModal layout tokens.
 */
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Ion = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onPrimary: () => void;
  title: string;
  message: string;
  primaryLabel: string;
  icon?: Ion;
  dismissLabel?: string;
  dismissOnBackdrop?: boolean;
  /** When false, only the primary CTA is shown (e.g. welcome modals). */
  showDismiss?: boolean;
};

export function UpsellGateModal({
  visible,
  onDismiss,
  onPrimary,
  title,
  message,
  primaryLabel,
  icon = 'sparkles-outline',
  dismissLabel = 'Not now',
  dismissOnBackdrop = true,
  showDismiss = true,
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable
        style={styles.overlay}
        onPress={dismissOnBackdrop ? onDismiss : undefined}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Pressable style={styles.cardHit} onPress={(e) => e.stopPropagation()}>
          <View style={styles.card}>
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.iconWrap}>
              <Ionicons name={icon} size={32} color="#fff" />
            </LinearGradient>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{message}</Text>
            <Pressable
              onPress={onPrimary}
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
            >
              <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.btnGrad}>
                <Text style={styles.btnTxt}>{primaryLabel}</Text>
              </LinearGradient>
            </Pressable>
            {showDismiss ? (
              <Pressable
                onPress={onDismiss}
                style={styles.dismissBtn}
                accessibilityRole="button"
                accessibilityLabel={dismissLabel}
              >
                <Text style={styles.dismissTxt}>{dismissLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  cardHit: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  btn: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  btnPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  btnGrad: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: {
    color: '#fff',
    fontWeight: '800',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  dismissBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dismissTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
