/**
 * Create plan — Step 3: story, place, visibility, premium spotlight, publish.
 */
import { Input } from '@/components/Input';
import { CreatePlanStickyProgress } from '@/components/plans/create/CreatePlanProgressBar';
import { CreatePlanWizardBack } from '@/components/plans/create/CreatePlanWizardBack';
import { CreatePlanWizardFooter } from '@/components/plans/create/CreatePlanWizardFooter';
import { PlanLocationSection } from '@/components/plans/create/PlanLocationSection';
import { VisibilityPickCard } from '@/components/plans/create/VisibilityPickCard';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { colors, radius, spacing } from '@/constants/theme';
import { usePlanDraft, type PlanVisibility } from '@/contexts/PlanDraftContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  computeMoodWindowBounds,
  computeUrgencyLevel,
  moodNegotiationExpiresAt,
} from '@/lib/plans/moodPlanComputations';
import { applyMoodPlanLiveNow, moodPlanScheduledNow } from '@/lib/plans/moodPlanStart';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { usePermission } from '@/hooks/usePermission';
import { MIN_ESCROW_CENTS } from '@/lib/plans/planFinancialConfig';
import { checkPermission } from '@/lib/subscription/checkPermission';
import type { SubscriptionTier } from '@/lib/subscription/pricing';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { persistModerationAfterSend } from '@/lib/trust/persistModeration';
import { requiresVerificationGate } from '@/lib/verification/access';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EXAMPLES = ['Dinner in Lekki tonight', 'Gym partner this weekend', 'Coffee walk after work'];

const OPTIONS: {
  value: PlanVisibility;
  title: string;
  description: string;
  icon: 'globe-outline' | 'navigate-outline' | 'people-outline' | 'diamond-outline';
  tierBadge?: SubscriptionTier;
}[] = [
  {
    value: 'public',
    title: 'Public',
    description: 'Anyone on LinkUp can discover this plan in the feed.',
    icon: 'globe-outline',
  },
  {
    value: 'radius',
    title: 'Within radius',
    description: 'Shown to people roughly within your discovery radius.',
    icon: 'navigate-outline',
  },
  {
    value: 'friends',
    title: 'Friends only',
    description: 'Only your connections see this (once friends ship, this tightens automatically).',
    icon: 'people-outline',
  },
  {
    value: 'premium',
    title: 'Gold & Platinum only',
    description: 'Only Gold and Platinum members can discover this plan.',
    icon: 'diamond-outline',
    tierBadge: 'PLATINUM',
  },
];

export default function CreatePlanDetailsScreen() {
  const { draft, setDraft, reset } = usePlanDraft();
  const { user, dbUser, isAdmin, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('privacy.plan_creation');
  const { allowed: canSpotlight } = usePermission('boost.24hr');

  async function onSelectVisibility(value: PlanVisibility) {
    if (value === 'premium' && user?.id) {
      const perm = await checkPermission(user.id, 'privacy.plan_creation');
      if (!perm.allowed) {
        setUpgradeFeature('privacy.plan_creation');
        setUpgradeOpen(true);
        return;
      }
    }
    setDraft((d) => ({ ...d, visibility: value }));
  }

  async function onSpotlightToggle(v: boolean) {
    if (!user?.id) return;
    if (v) {
      const perm = await checkPermission(user.id, 'boost.24hr');
      if (!perm.allowed) {
        setUpgradeFeature('boost.24hr');
        setUpgradeOpen(true);
        return;
      }
    }
    setDraft((d) => ({ ...d, spotlightBoost: v }));
  }

  async function publish() {
    if (!user || !isSupabaseConfigured) return;
    if (
      requiresVerificationGate(dbUser?.verification_status, {
        isAdmin,
        verifiedBadge: profile?.verified_badge,
      })
    ) {
      setGateOpen(true);
      return;
    }
    if (!draft.title.trim() || !draft.scheduledAt || !draft.meetTypeId) {
      Alert.alert('Almost there', 'Add a title, time, and meet type.');
      return;
    }
    if (draft.isMoodPlan) {
      if (!draft.moodType?.trim() || !draft.moodExpiresAt) {
        Alert.alert('Mood plan', 'Pick a mood type and timing on step 1.');
        return;
      }
      if (draft.moodWindow === 'custom') {
        if (!draft.moodCustomStart || !draft.moodCustomEnd) {
          Alert.alert('Mood plan', 'Set your custom social window on step 1.');
          return;
        }
        if (draft.moodCustomEnd.getTime() <= draft.moodCustomStart.getTime()) {
          Alert.alert('Mood plan', 'Window end must be after the start.');
          return;
        }
      }
    }

    const startingCents =
      draft.isPaid && draft.startingPrice.trim() ? Math.round(Number(draft.startingPrice) * 100) : null;

    if (draft.isPaid) {
      if (!draft.startingPrice.trim() || Number.isNaN(Number(draft.startingPrice))) {
        Alert.alert('Price', 'Enter a valid amount in NGN for this paid plan.');
        return;
      }
      if (!startingCents || startingCents < MIN_ESCROW_CENTS) {
        Alert.alert('Price', `Minimum paid plan amount is ₦${MIN_ESCROW_CENTS / 100}.`);
        return;
      }
      if (!draft.escrowPattern) {
        Alert.alert('Escrow', 'Pick who funds the commitment (host, split, or guest).');
        return;
      }
      if (draft.escrowPattern === 'C') {
        const { data: uRow } = await supabase.from('users').select('kyc_tier').eq('id', user.id).maybeSingle();
        const tier = (uRow?.kyc_tier as number) ?? 1;
        if (tier < 2) {
          Alert.alert(
            'Tier 2 required',
            'Guest-funded plans need Tier 2 verification for you and your guest before escrow.'
          );
          return;
        }
      }
    }

    const moodDraft = draft.isMoodPlan ? applyMoodPlanLiveNow(draft) : draft;
    const moodScheduledAt = draft.isMoodPlan ? moodPlanScheduledNow() : draft.scheduledAt!;

    const moodExpiresIso =
      moodDraft.isMoodPlan && moodDraft.moodExpiresAt ? moodDraft.moodExpiresAt.toISOString() : null;

    const bounds =
      moodDraft.isMoodPlan
        ? computeMoodWindowBounds(
            moodDraft.moodWindow,
            moodDraft.moodCustomStart,
            moodDraft.moodCustomEnd,
            moodScheduledAt
          )
        : null;

    /** Ensures mood window timestamps are never omitted when publishing a mood row (DB + Discover). */
    const moodBounds =
      moodDraft.isMoodPlan
        ? bounds ?? computeMoodWindowBounds('now', null, null, moodScheduledAt)
        : null;

    const urgencyLevel =
      moodExpiresIso
        ? computeUrgencyLevel(new Date(moodExpiresIso), moodScheduledAt)
        : null;

    const isMoodRow = !!(draft.isMoodPlan && moodExpiresIso);

    const negotiationIso = isMoodRow
      ? moodNegotiationExpiresAt(true, 2)?.toISOString() ?? null
      : null;

    const boostHours = draft.isMoodPlan && canSpotlight ? 6 : canSpotlight && draft.spotlightBoost ? 4 : 0;
    const boostedUntilIso =
      canSpotlight && draft.spotlightBoost && boostHours > 0
        ? new Date(Date.now() + boostHours * 3600 * 1000).toISOString()
        : null;

    await refreshProfile();

    const {
      data: { user: liveUser },
      error: liveUserErr,
    } = await supabase.auth.getUser();
    if (liveUserErr || !liveUser?.id) {
      Alert.alert('Session', 'Could not confirm your login. Sign in again, then retry.');
      return;
    }

    setLoading(true);

    // Keys must match `public.plans` (see supabase migrations). Omitted columns use DB defaults.
    const insertRow: Record<string, unknown> = {
      creator_id: liveUser.id,
      meet_type_id: draft.meetTypeId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      starting_price_cents: startingCents,
      currency: 'NGN',
      status: 'negotiating',
      visibility: draft.visibility,
      scheduled_at: (draft.isMoodPlan ? moodScheduledAt : draft.scheduledAt!).toISOString(),
      location_label: draft.locationLabel.trim() || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
      is_paid: draft.isPaid,
      budget_min_cents: draft.isPaid ? startingCents : null,
      budget_max_cents: draft.isPaid ? startingCents : null,
      budget_tier: draft.isPaid ? draft.budgetTier : null,
      escrow_pattern: draft.isPaid ? draft.escrowPattern : null,
      host_contribution_bps:
        draft.isPaid && draft.escrowPattern === 'B' ? draft.hostContributionBps : null,
      is_mood_plan: isMoodRow,
      mood_expires_at: isMoodRow ? moodExpiresIso : null,
      duration_minutes: draft.durationMinutes,
      mood_type: isMoodRow ? draft.moodType?.trim() || null : null,
      mood_start_time: isMoodRow && moodBounds ? moodBounds.start.toISOString() : null,
      mood_end_time: isMoodRow && moodBounds ? moodBounds.end.toISOString() : null,
      auto_expiry_at: isMoodRow ? moodExpiresIso : null,
      urgency_level: isMoodRow ? urgencyLevel : null,
      negotiation_expires_at: isMoodRow ? negotiationIso : null,
      spotlight_enabled: !!draft.spotlightBoost,
      boosted_until: boostedUntilIso,
      is_group_plan: draft.isGroupPlan,
      max_free_guests: draft.isGroupPlan ? draft.maxFreeGuests : null,
      max_premium_guests: draft.isGroupPlan ? draft.maxPremiumGuests : null,
      max_guests: draft.isGroupPlan ? draft.maxGuests : null,
      multi_city: draft.isGroupPlan && draft.multiCity,
      city_ids: draft.isGroupPlan && draft.cityIds.length ? draft.cityIds : null,
    };

    const { data: planIdRaw, error } = await supabase.rpc('publish_plan', { payload: insertRow });

    setLoading(false);
    if (error) {
      const msg = error.message ?? '';
      const details =
        typeof error === 'object' && error && 'details' in error && typeof (error as { details?: string }).details === 'string'
          ? (error as { details: string }).details
          : '';
      const hint = `${msg}${details ? `\n\n${details}` : ''}`;
      if (msg.includes('escrow_pattern_b_requires_silver')) {
        Alert.alert('Silver required', 'Split escrow requires a Silver subscription or above.', [
          { text: 'Upgrade', onPress: () => router.push('/subscription' as Href) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else if (msg.includes('escrow_pattern_c_requires_gold')) {
        Alert.alert('Gold required', 'Guest-funded escrow requires a Gold subscription or above.', [
          { text: 'Upgrade', onPress: () => router.push('/subscription' as Href) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else if (/row-level security|violates row-level security|42501|Not allowed to publish/i.test(msg)) {
        void refreshProfile();
        Alert.alert(
          'Cannot publish',
          `The server rejected this publish (usually verification or RLS).\n\n` +
            `• Finish Verification in Settings, or confirm your latest KYC request is approved.\n` +
            `• In Supabase: apply migration 20260515120000_publish_plan_rpc.sql, then Dashboard → Settings → API → Reload schema.\n` +
            `• Sign out and back in, then try again.\n\n` +
            (hint.length < 400 ? `Technical: ${hint}` : `${hint.slice(0, 400)}…`)
        );
      } else {
        Alert.alert('Could not publish', hint.length > 800 ? `${hint.slice(0, 800)}…` : hint);
      }
      return;
    }
    if (planIdRaw == null) {
      Alert.alert('Could not publish', 'No plan id returned. Check Supabase logs and that publish_plan migration is applied.');
      return;
    }
    const planId = String(planIdRaw);
    const combo = `${draft.title.trim()}\n${draft.description.trim()}`.trim();
    void persistModerationAfterSend({
      contentType: 'plan',
      contentId: planId,
      textSample: combo.length ? combo : draft.title.trim(),
    });
    await reset();
    router.replace({ pathname: '/plan/create/success', params: { planId } } as Href);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false} safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenBg}>
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.background]}
            locations={[0, 0.28, 0.62, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <VerificationHardGateModal
            visible={gateOpen}
            onClose={() => setGateOpen(false)}
            verificationStatus={dbUser?.verification_status}
          />
          <UpgradePrompt
            visible={upgradeOpen}
            feature={upgradeFeature}
            requiredTier={upgradeFeature === 'privacy.plan_creation' ? 'PLATINUM' : 'SILVER'}
            onUpgrade={() => {
              setUpgradeOpen(false);
              router.push('/subscription' as Href);
            }}
            onDismiss={() => setUpgradeOpen(false)}
          />
          <CreatePlanStickyProgress current={2} />
          <CreatePlanWizardBack />
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            removeClippedSubviews={false}
            style={{ flex: 1 }}
          >
        <View style={styles.leadBlock}>
          <View style={styles.leadAccent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lead}>Bring it to life</Text>
            <Text style={styles.sub}>Title, story, location — then who can see it. Make it swipe-worthy.</Text>
          </View>
        </View>

        <LinearGradient
          colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.14)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.examplesOuter}
        >
          <View style={styles.examples}>
            <Text style={styles.exLabel}>Quick ideas · tap to use</Text>
            {EXAMPLES.map((ex) => (
              <Pressable key={ex} onPress={() => setDraft((d) => ({ ...d, title: ex }))} style={styles.exChip}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.exChipTxt}>{ex}</Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>

        <Input
          label="Title"
          variant="onboardingFlat"
          value={draft.title}
          onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))}
          placeholder="e.g. Dinner in Lekki tonight"
        />
        <Input
          label="Description (optional)"
          variant="onboardingFlat"
          multiline
          numberOfLines={4}
          value={draft.description}
          onChangeText={(t) => setDraft((d) => ({ ...d, description: t }))}
          placeholder="Intent, vibe, or what you’re offering"
        />

        <PlanLocationSection
          locationLabel={draft.locationLabel}
          onApply={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        />

        {canSpotlight ? (
          <LinearGradient
            colors={['#FFF9E6', '#F3EEFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumRow}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.premiumTitleRow}>
                <Ionicons name="diamond" size={18} color={colors.primary} />
                <Text style={styles.premiumTitle}>Spotlight this plan</Text>
              </View>
              <Text style={styles.premiumSub}>
                Longer boosted placement in Discover after publish
                {draft.isMoodPlan ? ' — extra priority for mood' : ''}.
              </Text>
            </View>
            <Switch
              value={draft.spotlightBoost}
              onValueChange={(v) => void onSpotlightToggle(v)}
              trackColor={{ true: colors.secondary, false: '#ccc' }}
            />
          </LinearGradient>
        ) : (
          <Pressable style={styles.premiumTease} onPress={() => router.push('/subscription' as Href)}>
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.premiumTeaseIcon}>
              <Ionicons name="diamond" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.premiumTeaseTxt}>Premium — spotlight & longer visibility</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
          </Pressable>
        )}

        <View style={styles.visHead}>
          <Ionicons name="eye-outline" size={20} color={colors.primary} />
          <Text style={styles.visTitle}>Visibility</Text>
        </View>
        <View style={styles.list}>
          {OPTIONS.map((opt) => (
            <VisibilityPickCard
              key={opt.value}
              title={opt.title}
              description={opt.description}
              icon={opt.icon}
              selected={draft.visibility === opt.value}
              onPress={() => void onSelectVisibility(opt.value)}
              badge={opt.tierBadge}
            />
          ))}
        </View>
          </ScrollView>
          <CreatePlanWizardFooter
            title="Publish plan"
            onPress={() => void publish()}
            loading={loading}
            disabled={!draft.title.trim()}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenBg: { backgroundColor: 'transparent' },
  scroll: { paddingBottom: 120, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  leadBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  leadAccent: {
    width: 5,
    marginTop: 6,
    borderRadius: 3,
    height: 48,
    backgroundColor: colors.primary,
  },
  lead: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.4, marginBottom: 6 },
  sub: { fontSize: 16, color: colors.textMuted, lineHeight: 23, fontWeight: '600' },
  examplesOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
  },
  examples: {
    padding: spacing.md,
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  exLabel: { fontSize: 12, fontWeight: '900', color: colors.primary, marginBottom: 10, letterSpacing: 0.3 },
  exChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  exChipTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
  visHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, marginBottom: spacing.sm },
  visTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  list: { marginTop: spacing.sm },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  premiumTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  premiumSub: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20, fontWeight: '600' },
  premiumTease: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.28)',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  premiumTeaseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTeaseTxt: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
});
