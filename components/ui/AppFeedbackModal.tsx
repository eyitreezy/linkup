/**
 * Inbox-grade feedback modal — replaces system Alert for profile, settings, and flows.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export type AppFeedbackVariant = 'success' | 'error' | 'warning';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  onClose: () => void;
  variant?: AppFeedbackVariant;
  kicker?: string;
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  /** Tap outside overlay to dismiss (default true). */
  dismissOnBackdrop?: boolean;
};

function variantMeta(variant: AppFeedbackVariant): {
  icon: IonName;
  iconGrad: readonly [string, string];
  ctaGrad: readonly [string, string];
} {
  switch (variant) {
    case 'error':
      return {
        icon: 'alert-circle-outline',
        iconGrad: [colors.danger, '#F87171'],
        ctaGrad: [colors.danger, '#F87171'],
      };
    case 'warning':
      return {
        icon: 'information-circle-outline',
        iconGrad: ['#F59E0B', '#FBBF24'],
        ctaGrad: [colors.primary, colors.secondary],
      };
    case 'success':
    default:
      return {
        icon: 'checkmark-circle-outline',
        iconGrad: [colors.primary, colors.secondary],
        ctaGrad: [colors.primary, colors.secondary],
      };
  }
}

export function AppFeedbackModal({
  visible,
  onClose,
  variant = 'success',
  kicker = 'LinkUp',
  title,
  message,
  primaryLabel = 'Got it',
  onPrimary,
  dismissOnBackdrop = true,
}: Props) {
  const meta = variantMeta(variant);

  function handlePrimary() {
    if (onPrimary) onPrimary();
    else onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={dismissOnBackdrop ? onClose : undefined}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.45)', 'rgba(255,101,132,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            <View style={styles.card}>
              <LinearGradient
                colors={[...meta.iconGrad]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGrad}
              >
                <Ionicons name={meta.icon} size={30} color="#fff" />
              </LinearGradient>

              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <Pressable
                onPress={handlePrimary}
                style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
              >
                <LinearGradient
                  colors={[...meta.ctaGrad]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGrad}
                >
                  <Text style={styles.ctaTxt}>{primaryLabel}</Text>
                </LinearGradient>
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
  sheetHit: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
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
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
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
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  ctaGrad: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  ctaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
