/**
 * Creator boost controls — quota-aware 24h / 72h boosts (labels match linkup-web).
 */
import { QuotaPipRow } from '@/components/subscription/QuotaPipRow';
import { TierBadge } from '@/components/TierBadge';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { colors, radius, spacing } from '@/constants/theme';
import { activatePlanBoost, hasLegacyBoostCredit } from '@/lib/premium/boostPlan';
import { checkPermission } from '@/lib/subscription/checkPermission';
import {
  boost24Label,
  boost24MetaFromPermission,
  boost72Label,
  boost72MetaFromPermission,
  isBoost24Exhausted,
  isBoost72Exhausted,
  MONTHLY_24H_BOOSTS,
} from '@/lib/subscription/boostQuota';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { supabase } from '@/lib/supabase';
import type { DbUser } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  planId: string;
  creatorId: string;
  dbUser: DbUser | null | undefined;
  boosted: boolean;
  boostedUntil?: string | null;
  moodClosed: boolean;
  onBoosted: () => void;
  onShowFeedback: (title: string, message: string) => void;
  cellStyle?: StyleProp<ViewStyle>;
  fullWidthCellStyle?: StyleProp<ViewStyle>;
};

function formatBoostExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function PlanBoostControls({
  planId,
  creatorId,
  dbUser,
  boosted,
  boostedUntil,
  moodClosed,
  onBoosted,
  onShowFeedback,
  cellStyle,
  fullWidthCellStyle,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [canBoost24, setCanBoost24] = useState(false);
  const [canBoost72, setCanBoost72] = useState(false);
  const [boost24Meta, setBoost24Meta] = useState<ReturnType<typeof boost24MetaFromPermission>>({});
  const [boost72Meta, setBoost72Meta] = useState<ReturnType<typeof boost72MetaFromPermission>>({});
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<SubscriptionTier>('SILVER');
  const [effectiveTier, setEffectiveTier] = useState<SubscriptionTier>('FREE');

  const refreshPerms = useCallback(async () => {
    if (!creatorId) return;
    const [p24, p72] = await Promise.all([
      checkPermission(creatorId, 'boost.24hr', { checkQuota: true }),
      checkPermission(creatorId, 'boost.72hr', { checkQuota: true }),
    ]);
    setCanBoost24(p24.allowed);
    setCanBoost72(p72.allowed);
    setEffectiveTier(p24.effectiveTier);
    setBoost24Meta(boost24MetaFromPermission(p24.metadata));
    setBoost72Meta(boost72MetaFromPermission(p72.metadata));
  }, [creatorId]);

  useEffect(() => {
    void refreshPerms();
  }, [refreshPerms]);

  const legacyCredit = hasLegacyBoostCredit(dbUser);
  const canUse24 = canBoost24 || legacyCredit;
  const boost24Exhausted = isBoost24Exhausted(boost24Meta);
  const boost72Exhausted = isBoost72Exhausted(boost72Meta);

  const disabled24 =
    moodClosed || busy || boosted || !canUse24 || (canBoost24 && boost24Exhausted);
  const disabled72 = moodClosed || busy || boosted || !canBoost72 || boost72Exhausted;

  function showActiveBoostNotice() {
    if (!boosted || !boostedUntil) return;
    onShowFeedback(
      'Active boost',
      `This plan is already boosted in Discover until ${formatBoostExpiry(boostedUntil)}.`
    );
  }

  async function runBoost(hours: 24 | 72) {
    if (!dbUser?.id || moodClosed || busy) return;
    if (boosted) {
      showActiveBoostNotice();
      return;
    }

    setBusy(true);
    const useCredit = hours === 24 && !canBoost24 && legacyCredit;
    const { error } = await activatePlanBoost(supabase, {
      planId,
      creatorId,
      hours,
      useLegacyCredit: useCredit,
    });
    setBusy(false);

    if (error) {
      onShowFeedback(hours === 72 ? '72h boost' : 'Boost plan', error);
      return;
    }

    onShowFeedback('Plan boosted', `Your plan is now boosted in Discover for ${hours} hours.`);
    await refreshPerms();
    onBoosted();
  }

  return (
    <>
      <UpgradePrompt
        visible={upgradeOpen}
        feature={upgradeTier === 'GOLD' ? 'boost.72hr' : 'boost.24hr'}
        requiredTier={upgradeTier}
        onUpgrade={() => {
          setUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />

      {boosted && boostedUntil ? (
        <View style={fullWidthCellStyle ?? cellStyle}>
          <Pressable
            accessibilityRole="button"
            onPress={showActiveBoostNotice}
            style={({ pressed }) => [styles.activeBoostCard, pressed && { opacity: 0.95 }]}
          >
            <View style={styles.activeBoostIcon}>
              <Ionicons name="flash" size={18} color="#fff" />
            </View>
            <View style={styles.activeBoostCopy}>
              <Text style={styles.activeBoostTitle}>Active boost</Text>
              <Text style={styles.activeBoostSub} numberOfLines={2}>
                Featured in Discover until {formatBoostExpiry(boostedUntil)}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {canUse24 ? (
        <View style={cellStyle}>
          <Pressable
            accessibilityRole="button"
            disabled={disabled24}
            onPress={() => {
              if (boosted) {
                showActiveBoostNotice();
                return;
              }
              void runBoost(24);
            }}
            style={({ pressed }) => [
              styles.secondaryBtn,
              disabled24 && styles.secondaryDisabled,
              pressed && !disabled24 && { opacity: 0.92 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="rocket-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryTxt} numberOfLines={2}>
                  {boost24Label(boost24Meta, canBoost24)}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={cellStyle}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setUpgradeTier('SILVER');
              setUpgradeOpen(true);
            }}
            style={({ pressed }) => [styles.secondaryBtn, styles.secondaryLocked, pressed && { opacity: 0.92 }]}
          >
            <Ionicons name="lock-closed" size={16} color={colors.primary} />
            <Text style={styles.secondaryTxt}>Boost plan</Text>
            <TierBadge tier="SILVER" compact />
          </Pressable>
        </View>
      )}

      {canBoost72 ? (
        <View style={cellStyle}>
          <Pressable
            accessibilityRole="button"
            disabled={disabled72}
            onPress={() => {
              if (boosted) {
                showActiveBoostNotice();
                return;
              }
              void runBoost(72);
            }}
            style={({ pressed }) => [
              styles.secondaryBtn,
              disabled72 && styles.secondaryDisabled,
              pressed && !disabled72 && { opacity: 0.92 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[styles.secondaryTxt, styles.secondaryTxtSm]} numberOfLines={2}>
                {boost72Label(boost72Meta, canBoost72)}
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={cellStyle}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setUpgradeTier('GOLD');
              setUpgradeOpen(true);
            }}
            style={({ pressed }) => [styles.secondaryBtn, styles.secondaryLocked, pressed && { opacity: 0.92 }]}
          >
            <Ionicons name="lock-closed" size={14} color={colors.primary} />
            <Text style={[styles.secondaryTxt, styles.secondaryTxtSm]}>Boost 72h</Text>
            <TierBadge tier="GOLD" compact />
          </Pressable>
        </View>
      )}

      {canUse24 ? (
        <View style={fullWidthCellStyle ?? { width: '100%' }}>
          <QuotaPipRow
            total={Math.max(0, MONTHLY_24H_BOOSTS[effectiveTier])}
            used={boost24Meta.boosts_24hr_used ?? 0}
            unlimited={effectiveTier === 'PLATINUM'}
            unlimitedLabel="Unlimited boosts"
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  activeBoostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    backgroundColor: 'rgba(237, 232, 255, 0.8)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  activeBoostIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  activeBoostCopy: { flex: 1, minWidth: 0 },
  activeBoostTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  activeBoostSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  secondaryBtn: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.25)',
    backgroundColor: colors.surface,
  },
  secondaryLocked: { opacity: 0.6 },
  secondaryDisabled: { opacity: 0.5 },
  secondaryTxt: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  secondaryTxtSm: { fontSize: 13 },
});
