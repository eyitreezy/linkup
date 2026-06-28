/**
 * Payment path picker — inbox-grade centered modal.
 */
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Option = {
  title: string;
  description: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  options: Option[];
};

export function SupportPaymentDisambigModal({ visible, onClose, options }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(94, 82, 255,0.45)', 'rgba(255, 74, 114,0.28)']}
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
                <Ionicons name="card-outline" size={28} color="#fff" />
              </LinearGradient>

              <Text style={styles.kicker}>Payment & escrow</Text>
              <Text style={styles.title}>What&apos;s the issue?</Text>
              <Text style={styles.message}>
                You have active escrow — pick the path that matches your situation.
              </Text>

              {options.map((opt, i) => (
                <Pressable
                  key={opt.title}
                  style={({ pressed }) => [
                    styles.option,
                    i < options.length - 1 && styles.optionGap,
                    pressed && styles.optionPressed,
                  ]}
                  onPress={opt.onPress}
                  accessibilityRole="button"
                >
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </Pressable>
              ))}

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.dismissBtn, pressed && styles.dismissPressed]}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.dismissTxt}>Cancel</Text>
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
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheetHit: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
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
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
    backgroundColor: colors.authInputBg,
  },
  optionGap: {
    marginBottom: spacing.sm,
  },
  optionPressed: {
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
  },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 19,
  },
  dismissBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(94, 82, 255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  dismissPressed: { opacity: 0.92 },
  dismissTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
