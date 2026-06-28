import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onReview: () => void;
  onDismiss: () => void;
};

export function PrivacyReconsentBanner({ onReview, onDismiss }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={onReview} style={styles.main} accessibilityRole="button">
        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
        <Text style={styles.text}>We&apos;ve updated our Privacy Policy</Text>
        <Text style={styles.cta}>Review & accept →</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss privacy policy banner"
      >
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(94, 82, 255,0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.15)',
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { flex: 1, fontSize: 13, fontWeight: '700', fontFamily: fonts.medium, color: colors.text },
  cta: { fontSize: 13, fontWeight: '800', color: colors.primary, fontFamily: fonts.bold },
});
