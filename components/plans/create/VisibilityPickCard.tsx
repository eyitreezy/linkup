/**
 * Bumble-style selectable card for plan visibility (PL2).
 * Selected ring matches KycSelectionCard / FundingPatternCard — inner Pressable owns layout.
 */
import { onboardingInputShadow } from '@/components/Input';
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  badge?: SubscriptionTier;
};

const FIELD_BORDER = '#D8DCE6';
const CARD_RADIUS = radius.xl;

export function VisibilityPickCard({ title, description, icon, selected, onPress, badge }: Props) {
  const inner = (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.cardInner, pressed && styles.cardPressed]}
    >
      <LinearGradient
        colors={
          selected
            ? ['rgba(94, 82, 255,0.2)', 'rgba(255, 74, 114,0.12)']
            : ['rgba(94, 82, 255,0.06)', 'rgba(255, 74, 114,0.03)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconWrap}
      >
        <Ionicons name={icon} size={26} color={selected ? colors.primary : colors.textMuted} />
      </LinearGradient>

      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, selected && styles.titleOn]}>{title}</Text>
          {badge ? (
            <View style={[styles.badge, selected && styles.badgeOn]}>
              <Text style={styles.badgeTxt}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.body}>{description}</Text>
      </View>

      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
    </Pressable>
  );

  if (selected) {
    return (
      <LinearGradient
        colors={[...APP_CHIP_GRADIENT]}
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

const styles = StyleSheet.create({
  ring: {
    alignSelf: 'stretch',
    borderRadius: CARD_RADIUS + 2,
    padding: 2,
    marginBottom: spacing.md,
    ...onboardingInputShadow,
  },
  cardOuter: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    borderColor: FIELD_BORDER,
    backgroundColor: colors.surface,
    ...onboardingInputShadow,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: spacing.md,
  },
  cardPressed: { opacity: 0.94 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 17, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text },
  titleOn: { color: colors.primary },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
  },
  badgeOn: {
    backgroundColor: 'rgba(94, 82, 255,0.12)',
    borderColor: 'rgba(94, 82, 255,0.22)',
  },
  badgeTxt: { fontSize: 9, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.primary },
  body: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium, },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  radioOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
