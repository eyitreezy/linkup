/**
 * Selectable escrow funding pattern — stable inner layout, gradient ring when selected.
 */
import { onboardingInputShadow } from '@/components/Input';
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

const FIELD_BORDER = '#D8DCE6';
const CARD_RADIUS = radius.lg;

type Props = {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  tierBadge?: SubscriptionTier;
};

export function FundingPatternCard({
  title,
  description,
  icon,
  selected,
  onPress,
  tierBadge,
}: Props) {
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
            ? ['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.12)']
            : ['rgba(108,99,255,0.06)', 'rgba(255,101,132,0.03)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconWrap}
      >
        <Ionicons name={icon} size={22} color={selected ? colors.primary : colors.textMuted} />
      </LinearGradient>

      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, selected && styles.titleOn]} numberOfLines={1}>
            {title}
          </Text>
          {tierBadge ? (
            <View style={[styles.tierBadge, selected && styles.tierBadgeOn]}>
              <Text style={styles.tierBadgeTxt}>{tierBadge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
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
    borderRadius: CARD_RADIUS + 2,
    padding: 2,
    marginBottom: spacing.sm,
    ...onboardingInputShadow,
  },
  cardOuter: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    ...onboardingInputShadow,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: spacing.md,
  },
  cardPressed: { opacity: 0.94 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  titleOn: { color: colors.primary },
  tierBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
  },
  tierBadgeOn: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  tierBadgeTxt: { fontSize: 9, fontWeight: '900', color: colors.primary, letterSpacing: 0.4 },
  description: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18, fontWeight: '600' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.button,
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
