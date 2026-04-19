/**
 * PL6a — primary / secondary actions (Tinder-style emphasis on primary).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel: string;
  onSecondary: () => void;
  secondaryDisabled?: boolean;
};

export function PlanAgreementCTAButton({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
}: Props) {
  const primaryOff = primaryDisabled || primaryLoading;
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPrimary}
        disabled={primaryOff}
        style={({ pressed }) => [
          styles.primary,
          primaryOff && styles.primaryOff,
          pressed && !primaryOff && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
      >
        {primaryLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={onSecondary}
        disabled={secondaryDisabled}
        style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.88 }]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>{secondaryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: 0 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryOff: { backgroundColor: '#C4BFFD' },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  secondary: {
    borderRadius: radius.button,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.secondary, fontSize: 16, fontWeight: '700' },
});
