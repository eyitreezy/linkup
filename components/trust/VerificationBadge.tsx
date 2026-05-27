import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  verified: boolean;
  /** `subtle` = icon + small text on overlays; `chip` = pill for lists; `hero` = high-contrast pill on discovery cards */
  variant?: 'subtle' | 'chip' | 'hero';
};

export function VerificationBadge({ verified, variant = 'chip' }: Props) {
  if (!verified) return null;
  if (variant === 'hero') {
    return (
      <View style={styles.hero} accessibilityLabel="Verified member">
        <Ionicons name="shield-checkmark" size={15} color="#fff" />
        <Text style={styles.heroTxt}>Verified</Text>
      </View>
    );
  }
  if (variant === 'subtle') {
    return (
      <View style={styles.subtle} accessibilityLabel="Verified member">
        <Ionicons name="shield-checkmark" size={14} color="#fff" />
        <Text style={styles.subtleTxt}>Verified</Text>
      </View>
    );
  }
  return (
    <View style={styles.chip} accessibilityLabel="Verified member">
      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
      <Text style={styles.chipTxt}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.button,
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.58)',
    shadowColor: '#3d0a18',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  heroTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  subtleTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  chipTxt: { fontSize: 11, fontWeight: '800', color: colors.primary },
});
