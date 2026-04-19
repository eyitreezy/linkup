/**
 * Large selectable card for KYC document type (Tinder-style tap target + Bumble structure).
 */
import { kycColors, kycShadow } from '@/components/kyc/kycTheme';
import { radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type KycIonName = ComponentProps<typeof Ionicons>['name'];

export type KycSelectionCardProps = {
  icon: KycIonName;
  title: string;
  helper: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

export function KycSelectionCard({ icon, title, helper, selected, onPress, testID }: KycSelectionCardProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.iconWrap, selected && styles.iconWrapOn]}>
        <Ionicons name={icon} size={28} color={selected ? kycColors.primary : kycColors.muted} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.helper}>{helper}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kycColors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(26, 29, 38, 0.08)',
    gap: spacing.md,
    ...kycShadow,
  },
  cardSelected: {
    borderColor: kycColors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cardPressed: { opacity: 0.92 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F0F1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: { backgroundColor: 'rgba(108, 99, 255, 0.14)' },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: kycColors.text, marginBottom: 4 },
  helper: { fontSize: 14, color: kycColors.muted, lineHeight: 20 },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  radioOn: { backgroundColor: kycColors.primary, borderColor: kycColors.primary },
});
