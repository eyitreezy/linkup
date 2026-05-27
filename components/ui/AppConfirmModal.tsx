/**
 * Inbox-grade two-action modal — confirmations (logout, boost, archive, etc.).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type IonName = ComponentProps<typeof Ionicons>['name'];

export type AppConfirmIconVariant = 'default' | 'logout' | 'boost' | 'warning' | 'danger';

type Props = {
  visible: boolean;
  onClose: () => void;
  kicker?: string;
  title: string;
  message: string;
  /** Gradient CTA — usually the safe or primary action */
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
  secondaryLabel: string;
  /** Defaults to `onClose` */
  onSecondary?: () => void | Promise<void>;
  secondaryTone?: 'neutral' | 'danger';
  iconVariant?: AppConfirmIconVariant;
  dismissOnBackdrop?: boolean;
  /** Which button shows a spinner while `onPrimary` / `onSecondary` runs */
  busyOn?: 'primary' | 'secondary';
  /** Side-by-side CTAs (default) or stacked */
  actionsLayout?: 'row' | 'stack';
};

function iconMeta(variant: AppConfirmIconVariant): {
  icon: IonName;
  grad: readonly [string, string];
} {
  switch (variant) {
    case 'logout':
      return { icon: 'log-out-outline', grad: [colors.primary, colors.secondary] };
    case 'boost':
      return { icon: 'rocket-outline', grad: ['#F59E0B', colors.secondary] };
    case 'warning':
      return { icon: 'information-circle-outline', grad: ['#F59E0B', '#FBBF24'] };
    case 'danger':
      return { icon: 'alert-circle-outline', grad: [colors.danger, '#F87171'] };
    default:
      return { icon: 'help-circle-outline', grad: [colors.primary, colors.secondary] };
  }
}

export function AppConfirmModal({
  visible,
  onClose,
  kicker = 'LinkUp',
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  secondaryTone = 'neutral',
  iconVariant = 'default',
  dismissOnBackdrop = true,
  busyOn = 'secondary',
  actionsLayout = 'row',
}: Props) {
  const [busy, setBusy] = useState(false);
  const meta = iconMeta(iconVariant);

  const runPrimary = useCallback(async () => {
    if (busy) return;
    if (busyOn === 'primary') setBusy(true);
    try {
      await Promise.resolve(onPrimary());
    } finally {
      if (busyOn === 'primary') setBusy(false);
    }
  }, [busy, busyOn, onPrimary]);

  const runSecondary = useCallback(async () => {
    if (busy) return;
    const fn = onSecondary ?? onClose;
    if (busyOn === 'secondary') setBusy(true);
    try {
      await Promise.resolve(fn());
    } finally {
      if (busyOn === 'secondary') setBusy(false);
    }
  }, [busy, busyOn, onSecondary, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={busy ? undefined : onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={dismissOnBackdrop && !busy ? onClose : undefined}
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
              <LinearGradient colors={[...meta.grad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconGrad}>
                <Ionicons name={meta.icon} size={28} color="#fff" />
              </LinearGradient>

              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View
                style={[
                  styles.actionsRow,
                  actionsLayout === 'stack' && styles.actionsStack,
                ]}
              >
                <Pressable
                  onPress={() => void runSecondary()}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    actionsLayout === 'row' ? styles.actionFit : styles.actionStretch,
                    secondaryTone === 'danger' && styles.secondaryBtnDanger,
                    pressed && !busy && styles.ctaPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={secondaryLabel}
                >
                  {busy && busyOn === 'secondary' ? (
                    <ActivityIndicator color={secondaryTone === 'danger' ? colors.danger : colors.primary} />
                  ) : (
                    <Text
                      style={[
                        styles.secondaryTxt,
                        secondaryTone === 'danger' && styles.secondaryTxtDanger,
                      ]}
                      numberOfLines={1}
                    >
                      {secondaryLabel}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => void runPrimary()}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.ctaOuter,
                    actionsLayout === 'row' ? styles.actionFit : styles.actionStretch,
                    actionsLayout === 'stack' && styles.ctaStacked,
                    pressed && !busy && styles.ctaPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaGrad}
                  >
                    {busy && busyOn === 'primary' ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.ctaTxt} numberOfLines={1}>
                        {primaryLabel}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
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
  actionsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  actionsStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionFit: {
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: '100%',
  },
  actionStretch: {
    alignSelf: 'stretch',
  },
  ctaOuter: {
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
  ctaStacked: {
    alignSelf: 'stretch',
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  ctaGrad: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  ctaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(108,99,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  secondaryBtnDanger: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  secondaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  secondaryTxtDanger: {
    color: colors.danger,
  },
});
