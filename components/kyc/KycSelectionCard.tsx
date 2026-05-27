/**
 * Large selectable card for KYC document type — inbox frosted card + gradient ring when selected.
 */
import { kycColors } from '@/components/kyc/kycTheme';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const inner = (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.cardInner, pressed && styles.cardPressed]}
    >
      <LinearGradient
        colors={
          selected
            ? ['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']
            : ['rgba(108,99,255,0.06)', 'rgba(255,101,132,0.03)']
        }
        style={styles.iconWrap}
      >
        <Ionicons name={icon} size={28} color={selected ? colors.primary : kycColors.muted} />
      </LinearGradient>
      <View style={styles.textCol}>
        <Text style={[styles.title, selected && styles.titleOn]}>{title}</Text>
        <Text style={styles.helper}>{helper}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
      </View>
    </Pressable>
  );

  if (selected) {
    return (
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ring}
      >
        {inner}
      </LinearGradient>
    );
  }

  return <View style={styles.cardOuter}>{inner}</View>;
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  cardOuter: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardPressed: { opacity: 0.94 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: kycColors.text, marginBottom: 4 },
  titleOn: { color: colors.primary },
  helper: { fontSize: 14, color: kycColors.muted, lineHeight: 20, fontWeight: '600' },
  radio: {
    width: 28,
    height: 28,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  radioOn: { backgroundColor: kycColors.primary, borderColor: kycColors.primary },
});
