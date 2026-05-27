/**
 * KYC-style notice — inbox-grade modal with gradient ring + primary CTA.
 */
import { kycColors } from '@/components/kyc/kycTheme';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel?: string;
};

export function KycNoticeModal({ visible, onClose, title, message, actionLabel = 'Got it' }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.45)', 'rgba(255,101,132,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            <View style={styles.card}>
              <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.iconGrad}>
                <Ionicons name="shield-checkmark" size={28} color="#fff" />
              </LinearGradient>
              <Text style={styles.kicker}>Verification</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{message}</Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGrad}
                >
                  <Text style={styles.ctaTxt}>{actionLabel}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ctaShadow = Platform.select({
  ios: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  android: { elevation: 4 },
  default: {},
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 29, 38, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheetHit: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  ring: { borderRadius: radius.xl + 4, padding: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
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
    color: kycColors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    color: kycColors.muted,
    lineHeight: 22,
    marginBottom: spacing.lg,
    textAlign: 'center',
    fontWeight: '600',
  },
  ctaOuter: {
    width: '100%',
    borderRadius: radius.button,
    overflow: 'hidden',
    ...ctaShadow,
  },
  ctaPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  ctaGrad: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ctaTxt: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
