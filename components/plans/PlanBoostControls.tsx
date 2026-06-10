/**
 * Creator boost controls — quota-aware 24h / 72h boosts.
 */
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { colors, radius, spacing } from '@/constants/theme';
import { activatePlanBoost } from '@/lib/premium/boostPlan';
import { hasLegacyBoostCredit } from '@/lib/premium/boostPlan';
import { checkPermission } from '@/lib/subscription/checkPermission';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { supabase } from '@/lib/supabase';
import type { DbUser } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  planId: string;
  creatorId: string;
  dbUser: DbUser | null | undefined;
  boosted: boolean;
  moodClosed: boolean;
  onBoosted: () => void;
  onShowFeedback: (title: string, message: string) => void;
};

function nextMonthLabel(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PlanBoostControls({
  planId,
  creatorId,
  dbUser,
  boosted,
  moodClosed,
  onBoosted,
  onShowFeedback,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [boost24, setBoost24] = useState<{ allowed: boolean; used?: number; limit?: number }>({
    allowed: false,
  });
  const [boost72, setBoost72] = useState<{ allowed: boolean; used?: number; limit?: number }>({
    allowed: false,
  });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<SubscriptionTier>('SILVER');

  const refreshPerms = useCallback(async () => {
    if (!creatorId) return;
    const [p24, p72] = await Promise.all([
      checkPermission(creatorId, 'boost.24hr', { checkQuota: true }),
      checkPermission(creatorId, 'boost.72hr', { checkQuota: true }),
    ]);
    setBoost24({
      allowed: p24.allowed,
      used: p24.metadata?.quota_used as number | undefined,
      limit: p24.metadata?.quota_limit as number | undefined,
    });
    setBoost72({
      allowed: p72.allowed,
      used: p72.metadata?.quota_used as number | undefined,
      limit: p72.metadata?.quota_limit as number | undefined,
    });
  }, [creatorId]);

  useEffect(() => {
    void refreshPerms();
  }, [refreshPerms]);

  async function runBoost(hours: 24 | 72) {
    if (!dbUser?.id || moodClosed) return;
    setBusy(true);
    const useCredit = !boost24.allowed && hasLegacyBoostCredit(dbUser);
    const { error } = await activatePlanBoost(supabase, {
      planId,
      creatorId,
      hours,
      useLegacyCredit: useCredit,
    });
    setBusy(false);
    if (error) {
      onShowFeedback('Boost', error);
      return;
    }
    onShowFeedback('Boosted', `Plan boosted for ${hours} hours.`);
    await refreshPerms();
    onBoosted();
  }

  function label24(): string {
    if (boost24.limit === -1 || boost24.allowed && boost24.limit == null) return 'Boost';
    if (!boost24.allowed && !hasLegacyBoostCredit(dbUser)) return 'Upgrade to boost';
    if (boost24.allowed && boost24.limit != null && boost24.used != null) {
      const left = boost24.limit - boost24.used;
      if (left <= 0) return `No boosts left · resets ${nextMonthLabel()}`;
      return `Boost (24h) · ${left} left`;
    }
    return 'Boost (24h)';
  }

  const disabled24 =
    moodClosed ||
    busy ||
    boosted ||
    (!boost24.allowed && !hasLegacyBoostCredit(dbUser)) ||
    (boost24.limit != null && boost24.limit > 0 && boost24.used != null && boost24.used >= boost24.limit);

  return (
    <View style={styles.wrap}>
      <UpgradePrompt
        visible={upgradeOpen}
        feature="boost.24hr"
        requiredTier={upgradeTier}
        onUpgrade={() => {
          setUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />
      <Pressable
        disabled={disabled24}
        onPress={() => {
          if (!boost24.allowed && !hasLegacyBoostCredit(dbUser)) {
            setUpgradeTier('SILVER');
            setUpgradeOpen(true);
            return;
          }
          void runBoost(24);
        }}
        style={({ pressed }) => [styles.primaryOuter, disabled24 && styles.disabled, pressed && !disabled24 && { opacity: 0.92 }]}
      >
        <LinearGradient
          colors={disabled24 ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryGrad}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {!boost24.allowed && !hasLegacyBoostCredit(dbUser) ? (
                <Ionicons name="lock-closed" size={16} color="#fff" style={{ marginRight: 6 }} />
              ) : null}
              <Text style={styles.primaryTxt} numberOfLines={1}>
                {label24()}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>

      {boost72.allowed || boost72.limit === 0 ? (
        <Pressable
          disabled={moodClosed || busy || boosted || !boost72.allowed}
          onPress={() => {
            if (!boost72.allowed) {
              setUpgradeTier('GOLD');
              setUpgradeOpen(true);
              return;
            }
            void runBoost(72);
          }}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.secondaryTxt}>
            {boost72.limit != null && boost72.used != null && boost72.limit > 0
              ? `72h boost · ${Math.max(0, boost72.limit - boost72.used)} left`
              : '72h boost'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 8 },
  primaryOuter: { borderRadius: radius.button, overflow: 'hidden', flex: 1 },
  disabled: { opacity: 0.65 },
  primaryGrad: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(108,99,255,0.28)',
  },
  secondaryTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
});
