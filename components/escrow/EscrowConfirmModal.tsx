import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Ion = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Primary = brand purple; danger = coral (destructive). */
  confirmVariant?: 'primary' | 'danger';
};

export function EscrowConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
}: Props) {
  const icon: Ion = confirmVariant === 'danger' ? 'warning-outline' : 'shield-checkmark-outline';
  const gradColors =
    confirmVariant === 'danger'
      ? ([colors.secondary, '#FF8A9B'] as const)
      : ([colors.primary, colors.secondary] as const);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.1)', 'rgba(255,101,132,0.05)', 'transparent']}
            style={styles.topGlow}
          />
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={24} color={confirmVariant === 'danger' ? colors.secondary : colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <Pressable onPress={onCancel} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostTxt}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.btnOuter}>
              <LinearGradient colors={[...gradColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGrad}>
                <Text style={styles.btnPrimaryTxt}>{confirmLabel}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
    textAlign: 'center',
    fontWeight: '600',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1, minHeight: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnOuter: { flex: 1, borderRadius: radius.button, overflow: 'hidden' },
  btnGrad: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  btnGhost: { borderWidth: 1, borderColor: '#D8DCE6', backgroundColor: colors.surface },
  btnGhostTxt: { fontSize: 16, fontWeight: '800', color: colors.text },
  btnPrimaryTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
