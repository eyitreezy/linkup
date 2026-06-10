import { TierBadge } from '@/components/TierBadge';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import {
  hasActiveGoldTrial,
  hasActiveSilverTrial,
} from '@/lib/subscription/effectiveTier';
import { tierDisplayName } from '@/lib/subscription/featureLabels';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import type { DbUser } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  effective: SubscriptionTier;
  dbUser: DbUser | null | undefined;
  paidActive: boolean;
  silverTrialDays: number;
  goldTrialDays: number;
};

export function MembershipHero({
  effective,
  dbUser,
  paidActive,
  silverTrialDays,
  goldTrialDays,
}: Props) {
  const isSubscriber = effective !== 'FREE';
  const silverTrial = hasActiveSilverTrial(dbUser) && !paidActive;
  const goldTrial = hasActiveGoldTrial(dbUser);
  const expiresLabel = dbUser?.subscription_expires_at
    ? new Date(dbUser.subscription_expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null;

  if (!isSubscriber) {
    return (
      <LinearGradient
        colors={[...APP_CTA_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGrad}
      >
        <View style={styles.heroInner}>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>LinkUp membership</Text>
            <Text style={styles.heroTitle}>Meet more, stress less</Text>
            <Text style={styles.heroSub}>
              Boost plans, unlock group meetups, and get the tools that help you connect faster.
            </Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  const statusLine = silverTrial
    ? `Silver trial · ${silverTrialDays} days left`
    : goldTrial
      ? `Gold trial · ${goldTrialDays} days left`
      : paidActive && expiresLabel
        ? `Renews ${expiresLabel}`
        : 'Membership active';

  return (
    <LinearGradient
      colors={[...APP_CTA_GRADIENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroGrad}
    >
      <View style={styles.heroInner}>
        <View style={styles.heroIcon}>
          <Ionicons name="diamond" size={24} color={colors.primary} />
        </View>
        <View style={styles.heroText}>
          <View style={styles.heroBadgeRow}>
            <Text style={styles.heroKicker}>Your plan</Text>
            <TierBadge tier={effective} compact />
          </View>
          <Text style={styles.heroTitle}>{tierDisplayName(effective)}</Text>
          <Text style={styles.heroSub}>{statusLine}</Text>
        </View>
        <View style={styles.activePill}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.activePillTxt}>Active</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroGrad: {
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, minWidth: 0 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.35,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 20,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  activePillTxt: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
});
