/**
 * Creator boost controls — quota-aware 24h / 72h boosts (labels match linkup-web).
 */
import { QuotaPipRow } from '@/components/subscription/QuotaPipRow';
import { TierBadge } from '@/components/TierBadge';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { colors, radius, spacing, fonts } from '@/constants/theme';
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
import {
  DEFAULT_BOOST_RADIUS_KM,
} from '@/lib/plans/tierRelativePremiumVisibility';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { supabase } from '@/lib/supabase';
import type { DbPlan, DbUser } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  planVisibility?: DbPlan['visibility'];
  boostRadiusKm?: number | null;
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
  planVisibility,
  boostRadiusKm,
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
  const showGoldPremiumBoostNote =
    effectiveTier === 'GOLD' && planVisibility === 'premium' && !boosted;
  const boostRadiusLabel = boostRadiusKm ?? DEFAULT_BOOST_RADIUS_KM;

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
            style={({ pressed }) => [pressed && { opacity: 0.96 }]}
          >
            <LinearGradient
              colors={['rgba(94, 82, 255, 0.16)', 'rgba(255, 74, 114, 0.1)', 'rgba(237, 232, 255, 0.85)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeBoostCard}
            >
              <View style={styles.activeBoostTop}>
                <LinearGradient
                  colors={[colors.primary, '#8B7CFF', colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeBoostIconRing}
                >
                  <Ionicons name="flash" size={18} color="#fff" />
                </LinearGradient>
                <View style={styles.activeBoostCopy}>
                  <View style={styles.activeBoostTitleRow}>
                    <Text style={styles.activeBoostTitle}>Active boost</Text>
                    <View style={styles.activeBoostLivePill}>
                      <Text style={styles.activeBoostLiveTxt}>LIVE</Text>
                    </View>
                  </View>
                  <Text style={styles.activeBoostSub} numberOfLines={2}>
                    Featured in Discover until {formatBoostExpiry(boostedUntil)}
                  </Text>
                </View>
              </View>
              {canUse24 && effectiveTier !== 'PLATINUM' ? (
                <View style={styles.activeBoostQuota}>
                  <QuotaPipRow
                    variant="embedded"
                    total={Math.max(0, MONTHLY_24H_BOOSTS[effectiveTier])}
                    used={boost24Meta.boosts_24hr_used ?? 0}
                  />
                </View>
              ) : null}
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      {showGoldPremiumBoostNote ? (
        <View style={fullWidthCellStyle ?? { width: '100%' }}>
          <Text style={styles.boostExpansionNote}>
            While boosted, Platinum members within {boostRadiusLabel}km will also be able to discover
            this plan.
          </Text>
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
              styles.secondaryBtnOuter,
              disabled24 && styles.secondaryDisabled,
              pressed && !disabled24 && { opacity: 0.94 },
            ]}
          >
            <LinearGradient
              colors={
                disabled24
                  ? ['rgba(229,231,235,0.9)', 'rgba(229,231,235,0.9)']
                  : ['rgba(255,255,255,0.98)', 'rgba(244,240,255,0.95)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.secondaryBtnInner}
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
            </LinearGradient>
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
            style={({ pressed }) => [styles.secondaryBtnOuter, styles.secondaryLocked, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.98)', 'rgba(244,240,255,0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.secondaryBtnInner}
            >
              <Ionicons name="lock-closed" size={16} color={colors.primary} />
              <Text style={styles.secondaryTxt}>Boost plan</Text>
              <TierBadge tier="SILVER" compact />
            </LinearGradient>
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
              styles.secondaryBtnOuter,
              disabled72 && styles.secondaryDisabled,
              pressed && !disabled72 && { opacity: 0.94 },
            ]}
          >
            <LinearGradient
              colors={
                disabled72
                  ? ['rgba(229,231,235,0.9)', 'rgba(229,231,235,0.9)']
                  : ['rgba(255,255,255,0.98)', 'rgba(255,245,248,0.95)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.secondaryBtnInner}
            >
              {busy ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={[styles.secondaryTxt, styles.secondaryTxtSm]} numberOfLines={2}>
                  {boost72Label(boost72Meta, canBoost72)}
                </Text>
              )}
            </LinearGradient>
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
            style={({ pressed }) => [styles.secondaryBtnOuter, styles.secondaryLocked, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.98)', 'rgba(255,245,248,0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.secondaryBtnInner}
            >
              <Ionicons name="lock-closed" size={14} color={colors.primary} />
              <Text style={[styles.secondaryTxt, styles.secondaryTxtSm]}>Boost 72h</Text>
              <TierBadge tier="GOLD" compact />
            </LinearGradient>
          </Pressable>
        </View>
      )}

    </>
  );
}

const styles = StyleSheet.create({
  activeBoostCard: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.22)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  activeBoostTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  activeBoostIconRing: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBoostCopy: { flex: 1, minWidth: 0 },
  activeBoostTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  activeBoostTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  activeBoostLivePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.button,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  activeBoostLiveTxt: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.success,
    letterSpacing: 0.8,
  },
  activeBoostSub: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  activeBoostQuota: {
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.14)',
  },
  boostExpansionNote: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  secondaryBtnOuter: {
    width: '100%',
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
  },
  secondaryBtnInner: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  secondaryLocked: { opacity: 0.62 },
  secondaryDisabled: { opacity: 0.5 },
  secondaryTxt: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  secondaryTxtSm: { fontSize: 13, fontFamily: fonts.bold },
});
