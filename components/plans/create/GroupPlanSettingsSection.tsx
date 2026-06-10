/**
 * Group plan settings — guest caps, multi-city (Platinum).
 */
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { APP_CHIP_GRADIENT, APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { usePermission } from '@/hooks/usePermission';
import { MultiCitySearchField } from '@/components/plans/create/MultiCitySearchField';
import { checkPermission } from '@/lib/subscription/checkPermission';
import { tierDisplayName } from '@/lib/subscription/featureLabels';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

type Props = { visible: boolean };

const MAX_GUEST_CAP = 20;

function TierPill({ tier }: { tier: SubscriptionTier }) {
  const isPlatinum = tier === 'PLATINUM';
  return (
    <LinearGradient
      colors={isPlatinum ? ['#F59E0B', '#EAB308'] : [colors.primary, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.tierPill}
    >
      <Text style={styles.tierPillTxt}>{tierDisplayName(tier)}</Text>
    </LinearGradient>
  );
}

export function GroupPlanSettingsSection({ visible }: Props) {
  const { draft, setDraft } = usePlanDraft();
  const { user } = useAuth();
  const { effectiveTier, metadata } = usePermission('group_plan.host', { skip: !visible });
  const multiCityPerm = usePermission('group_plan.multi_city', { skip: !visible || !draft.isGroupPlan });
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (!visible || !draft.isGroupPlan || !user?.id) return;
    void checkPermission(user.id, 'group_plan.host').then((perm) => {
      const caps = perm.metadata?.group_plan_caps as
        | { max_free_guests?: number; max_premium_guests?: number }
        | undefined;
      if (!caps) return;
      setDraft((d) => ({
        ...d,
        maxFreeGuests: caps.max_free_guests ?? d.maxFreeGuests,
        maxPremiumGuests: caps.max_premium_guests === -1 ? null : caps.max_premium_guests ?? null,
      }));
    });
  }, [visible, draft.isGroupPlan, user?.id, setDraft]);

  const caps = useMemo(() => {
    const raw = metadata?.group_plan_caps as
      | { max_free_guests?: number; max_premium_guests?: number }
      | undefined;
    return {
      maxFreeGuests: raw?.max_free_guests ?? (effectiveTier === 'PLATINUM' ? 10 : 5),
      maxPremiumGuests: raw?.max_premium_guests ?? -1,
    };
  }, [metadata, effectiveTier]);

  if (!visible || !draft.isGroupPlan) return null;

  const minGuests = 2;
  const maxGuests = Math.max(minGuests, draft.maxGuests);
  const atMin = maxGuests <= minGuests;
  const atMax = maxGuests >= MAX_GUEST_CAP;

  function bumpGuests(delta: number) {
    setDraft((d) => ({
      ...d,
      maxGuests: Math.min(MAX_GUEST_CAP, Math.max(minGuests, d.maxGuests + delta)),
      maxFreeGuests: caps.maxFreeGuests,
      maxPremiumGuests: caps.maxPremiumGuests === -1 ? null : caps.maxPremiumGuests,
    }));
  }

  async function onMultiCityToggle(v: boolean) {
    if (!user?.id) return;
    if (v) {
      const perm = await checkPermission(user.id, 'group_plan.multi_city');
      if (!perm.allowed) {
        setUpgradeOpen(true);
        return;
      }
      setDraft((d) => ({ ...d, multiCity: true }));
      return;
    }
    setDraft((d) => ({ ...d, multiCity: false, cityIds: [] }));
  }

  return (
    <MotiView
      from={{ opacity: 0.9, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280 }}
      style={styles.outer}
    >
      <UpgradePrompt
        visible={upgradeOpen}
        feature="group_plan.multi_city"
        requiredTier="PLATINUM"
        onUpgrade={() => {
          setUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />
      <LinearGradient
        colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.28)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ring}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <LinearGradient colors={[...APP_CTA_GRADIENT]} style={styles.headerIcon}>
              <Ionicons name="people" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>Group meetup</Text>
              <Text style={styles.title}>Group settings</Text>
              <Text style={styles.sub}>Set capacity and how far your invite reaches.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Maximum guests</Text>
            <View style={styles.stepperCard}>
              <Pressable
                onPress={() => bumpGuests(-1)}
                disabled={atMin}
                style={({ pressed }) => [styles.stepBtnOuter, atMin && styles.stepBtnDisabled, pressed && !atMin && styles.pressed]}
                accessibilityLabel="Decrease guests"
              >
                {atMin ? (
                  <View style={styles.stepBtnPlain}>
                    <Ionicons name="remove" size={22} color={colors.border} />
                  </View>
                ) : (
                  <LinearGradient colors={[...APP_CHIP_GRADIENT]} style={styles.stepBtnGrad}>
                    <Ionicons name="remove" size={22} color="#fff" />
                  </LinearGradient>
                )}
              </Pressable>

              <View style={styles.stepCenter}>
                <Text style={styles.stepVal}>{maxGuests}</Text>
                <Text style={styles.stepUnit}>guests</Text>
              </View>

              <Pressable
                onPress={() => bumpGuests(1)}
                disabled={atMax}
                style={({ pressed }) => [styles.stepBtnOuter, atMax && styles.stepBtnDisabled, pressed && !atMax && styles.pressed]}
                accessibilityLabel="Increase guests"
              >
                {atMax ? (
                  <View style={styles.stepBtnPlain}>
                    <Ionicons name="add" size={22} color={colors.border} />
                  </View>
                ) : (
                  <LinearGradient colors={[...APP_CHIP_GRADIENT]} style={styles.stepBtnGrad}>
                    <Ionicons name="add" size={22} color="#fff" />
                  </LinearGradient>
                )}
              </Pressable>
            </View>

            <View style={styles.capRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.capHint}>
                Up to <Text style={styles.capStrong}>{caps.maxFreeGuests}</Text> free-tier guests on your plan
              </Text>
              <TierPill tier={effectiveTier} />
            </View>
          </View>

          <LinearGradient
            colors={['rgba(245,158,11,0.12)', 'rgba(108,99,255,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.platinumBlock}
          >
            <View style={styles.platinumHead}>
              <View style={styles.platinumBadgeRow}>
                <Ionicons name="diamond" size={14} color="#B45309" />
                <Text style={styles.platinumKicker}>Platinum only</Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                if (!multiCityPerm.allowed) setUpgradeOpen(true);
              }}
              style={({ pressed }) => [styles.multiRow, pressed && multiCityPerm.allowed && { opacity: 0.94 }]}
            >
              <View style={styles.multiIconWrap}>
                <Ionicons name="earth-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.multiTextCol}>
                <Text style={styles.multiLabel}>Visible across multiple cities</Text>
                <Text style={styles.multiSub}>
                  {multiCityPerm.allowed
                    ? 'Reach members in 2–5 cities at once'
                    : 'Unlock wider group discovery'}
                </Text>
              </View>
              <Switch
                value={draft.multiCity}
                onValueChange={(v) => void onMultiCityToggle(v)}
                disabled={!multiCityPerm.allowed && !draft.multiCity}
                trackColor={{ true: colors.secondary, false: '#D8DCE6' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                ios_backgroundColor="#D8DCE6"
              />
            </Pressable>

            {!multiCityPerm.allowed ? (
              <Pressable onPress={() => setUpgradeOpen(true)} style={styles.platinumCta}>
                <Text style={styles.platinumCtaTxt}>Upgrade for multi-city reach</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </Pressable>
            ) : null}

            {draft.multiCity && multiCityPerm.allowed ? (
              <View style={styles.cityPickerWrap}>
                <MultiCitySearchField
                  selected={draft.cityIds}
                  onChange={(ids) =>
                    setDraft((d) => ({ ...d, cityIds: ids, multiCity: ids.length > 0 || d.multiCity }))
                  }
                />
              </View>
            ) : null}
          </LinearGradient>
        </View>
      </LinearGradient>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: spacing.lg },
  ring: { borderRadius: radius.xl + 2, padding: 2 },
  card: {
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  sub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 4, fontWeight: '600' },
  section: { marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(108,99,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.14)',
  },
  stepBtnOuter: { borderRadius: 14, overflow: 'hidden' },
  stepBtnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  stepBtnGrad: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlain: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  stepCenter: { alignItems: 'center', minWidth: 72 },
  stepVal: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  stepUnit: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  capRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
    paddingHorizontal: 2,
  },
  capHint: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18, fontWeight: '600', minWidth: 160 },
  capStrong: { fontWeight: '900', color: colors.text },
  tierPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  tierPillTxt: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.4 },
  platinumBlock: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  platinumHead: { marginBottom: spacing.sm },
  platinumBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  platinumKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  multiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  multiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
  },
  multiTextCol: { flex: 1, paddingRight: spacing.xs },
  multiLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  multiSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  platinumCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  platinumCtaTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
  cityPickerWrap: {
    marginTop: spacing.md,
  },
});
