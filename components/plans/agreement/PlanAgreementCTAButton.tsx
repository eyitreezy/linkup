/**
 * PL6a — primary / secondary actions (gradient + outline ring, inbox-aligned).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** When true, primary action is rendered elsewhere (e.g. inline with Message). */
  omitPrimary?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
};

export function PlanAgreementCTAButton({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  omitPrimary,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
}: Props) {
  const showSecondary = Boolean(secondaryLabel && onSecondary);
  if (omitPrimary && !showSecondary) return null;
  const primaryOff = primaryDisabled || primaryLoading;
  return (
    <View style={styles.wrap}>
      {!omitPrimary ? (
        <Pressable
          onPress={onPrimary}
          disabled={primaryOff}
          style={({ pressed }) => [
            styles.primaryOuter,
            pressed && !primaryOff && { opacity: 0.94, transform: [{ scale: 0.985 }] },
          ]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={
              primaryOff
                ? [colors.border, colors.border]
                : [colors.primary, colors.secondary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryGrad}
          >
            {primaryLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[styles.primaryText, primaryOff && styles.primaryTextMuted]}
                numberOfLines={2}
              >
                {primaryLabel}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      ) : null}
      {showSecondary ? (
        <Pressable
          onPress={onSecondary}
          disabled={secondaryDisabled}
          style={({ pressed }) => [
            styles.secondaryOuter,
            secondaryDisabled && { opacity: 0.5 },
            pressed && !secondaryDisabled && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.secondaryRing}
          >
            <View style={styles.secondaryInner}>
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: 0 },
  primaryOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.26,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
    }),
  },
  primaryGrad: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  primaryTextMuted: { color: 'rgba(255,255,255,0.7)' },
  secondaryOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  secondaryRing: {
    padding: 2,
    borderRadius: radius.button,
  },
  secondaryInner: {
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.secondary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
