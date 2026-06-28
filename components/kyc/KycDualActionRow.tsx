/**
 * Side-by-side KYC actions — matches footer Back/Continue styling (equal height, inbox-grade).
 */
import { kycCtaShadow } from '@/components/kyc/kycTheme';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export const KYC_DUAL_BTN_HEIGHT = 52;
const GHOST_RING = 2;

type Props = {
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  secondaryDisabled?: boolean;
};

export function KycDualActionRow({
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryBusy = false,
  secondaryDisabled = false,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onSecondary}
        disabled={secondaryDisabled}
        style={({ pressed }) => [
          styles.ghostOuter,
          secondaryDisabled && styles.disabled,
          pressed && !secondaryDisabled && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={secondaryLabel}
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ghostRing}
        >
          <View style={styles.ghostInner}>
            <Text style={styles.ghostTxt} numberOfLines={1}>
              {secondaryLabel}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
      <Pressable
        onPress={onPrimary}
        disabled={primaryDisabled || primaryBusy}
        style={({ pressed }) => [
          styles.primaryOuter,
          kycCtaShadow,
          (primaryDisabled || primaryBusy) && styles.disabled,
          pressed && !primaryDisabled && !primaryBusy && { opacity: 0.94, transform: [{ scale: 0.985 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
      >
        <LinearGradient
          colors={
            primaryDisabled || primaryBusy
              ? [colors.border, colors.border]
              : [colors.primary, colors.secondary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryGrad}
        >
          {primaryBusy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryTxt, primaryDisabled && styles.primaryTxtOff]} numberOfLines={1}>
              {primaryLabel}
            </Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    minHeight: KYC_DUAL_BTN_HEIGHT,
  },
  disabled: { opacity: 0.55 },
  ghostOuter: {
    flex: 1,
    height: KYC_DUAL_BTN_HEIGHT,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  ghostRing: {
    width: '100%',
    height: KYC_DUAL_BTN_HEIGHT,
    padding: GHOST_RING,
    borderRadius: radius.button,
  },
  ghostInner: {
    flex: 1,
    borderRadius: radius.button - GHOST_RING,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  ghostTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  primaryOuter: {
    flex: 1,
    height: KYC_DUAL_BTN_HEIGHT,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  primaryGrad: {
    height: KYC_DUAL_BTN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  primaryTxtOff: {
    color: 'rgba(255,255,255,0.72)',
  },
});
