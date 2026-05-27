/**
 * Dual-action footer — gradient primary + outline secondary (inbox-aligned).
 */
import { kycCtaShadow } from '@/components/kyc/kycTheme';
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  backLabel?: string;
  continueDisabled?: boolean;
};

export function KycStepFooter({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  backLabel = 'Back',
  continueDisabled = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.ghostOuter, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ghostRing}
          >
            <View style={styles.ghostInner}>
              <Text style={styles.ghostTxt}>{backLabel}</Text>
            </View>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={onContinue}
          disabled={continueDisabled}
          style={({ pressed }) => [
            styles.primaryOuter,
            kycCtaShadow,
            continueDisabled && { opacity: 0.55 },
            pressed && !continueDisabled && { opacity: 0.94, transform: [{ scale: 0.985 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
        >
          <LinearGradient
            colors={
              continueDisabled
                ? [colors.border, colors.border]
                : [colors.primary, colors.secondary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryGrad}
          >
            <Text style={[styles.primaryTxt, continueDisabled && styles.primaryTxtOff]}>{continueLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  ghostOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  ghostRing: {
    flex: 1,
    padding: 2,
    borderRadius: radius.button,
  },
  ghostInner: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  ghostTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  primaryOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  primaryGrad: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  primaryTxtOff: {
    color: 'rgba(255,255,255,0.72)',
  },
});
