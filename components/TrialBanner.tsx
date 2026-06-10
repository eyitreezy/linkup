import { colors, radius, spacing } from '@/constants/theme';
import { trialDaysRemaining } from '@/lib/subscription/effectiveTier';
import type { DbUser } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  dbUser: DbUser | null | undefined;
  onUpgrade: () => void;
  onDismiss: () => void;
  dismissed: boolean;
};

export function TrialBanner({ dbUser, onUpgrade, onDismiss, dismissed }: Props) {
  if (dismissed || !dbUser) return null;

  const paidActive =
    dbUser.subscription_tier !== 'FREE' &&
    dbUser.subscription_expires_at &&
    new Date(dbUser.subscription_expires_at).getTime() > Date.now();

  if (paidActive) return null;

  const silverDays = trialDaysRemaining(dbUser.silver_trial_expires_at);
  const goldDays = trialDaysRemaining(dbUser.gold_trial_expires_at);
  const activeSilver =
    dbUser.subscription_tier === 'FREE' && silverDays != null && silverDays > 0;
  const activeGold = dbUser.has_been_silver_subscriber && goldDays != null && goldDays > 0;

  if (!activeSilver && !activeGold) return null;

  const label = activeGold
    ? `Gold Explorer trial — ${goldDays} day${goldDays === 1 ? '' : 's'} remaining`
    : `Silver Explorer trial — ${silverDays} day${silverDays === 1 ? '' : 's'} remaining`;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onUpgrade} style={styles.main} accessibilityRole="button">
        <Ionicons name="sparkles" size={14} color={colors.primary} />
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.cta}>Upgrade →</Text>
      </Pressable>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss trial banner">
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
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  cta: { fontSize: 13, fontWeight: '800', color: colors.primary },
});
