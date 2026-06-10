/**
 * PL4 — plan overview, offers preview, actions, boost & interest (Premium).
 */
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { PlanReportFlagButton, PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { PlanScreenLoading } from '@/components/plans/PlanScreenLoading';
import { ReportSheet } from '@/components/trust/ReportSheet';
import { VerificationBadge } from '@/components/trust/VerificationBadge';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { addPlanToDeviceCalendar, planCanAddToCalendar } from '@/lib/plans/addPlanToDeviceCalendar';
import { ExpiredPlanShelfBanner } from '@/components/plans/ExpiredPlanShelfBanner';
import { PlanningTogetherLocationChip } from '@/components/plans/PlanningTogetherLocationChip';
import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { isPlanMoodWindowClosed, planExpiryReason } from '@/lib/plans/planExpiry';
import { isPlanSaved, recordPlanView, setPlanSaved } from '@/lib/plans/planEngagement';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { PlanBoostControls } from '@/components/plans/PlanBoostControls';
import { PlanGroupGuestsPanel } from '@/components/plans/PlanGroupGuestsPanel';
import { PlanInterestedStrip } from '@/components/plans/PlanInterestedStrip';
import { peekPlanDetailSeed, setPlanDetailSeed } from '@/lib/plans/planDetailSeed';
import { extendMoodPlan } from '@/lib/plans/moodPlanCooldown';
import { usePermission } from '@/hooks/usePermission';
import { checkPermission } from '@/lib/subscription/checkPermission';
import type { SubscriptionTier } from '@/types/database';
import { formatRelativeShort } from '@/lib/messaging/formatRelative';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { insertPlanCompletionAck } from '@/lib/plans/planCompletionAck';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlan, DbPlanOffer, OfferStatus } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ProfileMini = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  verified_badge: boolean | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
};

function planningPartnerContext(
  plan: DbPlan,
  userId: string | undefined,
  offers: DbPlanOffer[],
  profiles: Record<string, ProfileMini>
):
  | { mode: 'hosting' }
  | { mode: 'person'; roleLabel: string; profile: ProfileMini | undefined; otherUserId: string } {
  if (!userId) {
    return {
      mode: 'person',
      roleLabel: 'Your host',
      profile: profiles[plan.creator_id],
      otherUserId: plan.creator_id,
    };
  }
  const accepted = offers.find((o) => o.id === plan.accepted_offer_id);
  if (userId === plan.creator_id) {
    if (accepted) {
      return {
        mode: 'person',
        roleLabel: 'Your match',
        profile: profiles[accepted.bidder_id],
        otherUserId: accepted.bidder_id,
      };
    }
    return { mode: 'hosting' };
  }
  return {
    mode: 'person',
    roleLabel: 'Your host',
    profile: profiles[plan.creator_id],
    otherUserId: plan.creator_id,
  };
}

function offerStatusChip(status: OfferStatus): { label: string; bg: string; color: string } {
  switch (status) {
    case 'accepted':
      return { label: 'Accepted', bg: 'rgba(16, 185, 129, 0.14)', color: colors.success };
    case 'pending':
      return { label: 'Pending', bg: 'rgba(108, 99, 255, 0.12)', color: colors.primary };
    case 'countered':
      return { label: 'Countered', bg: 'rgba(255, 101, 132, 0.12)', color: colors.secondary };
    case 'declined':
      return { label: 'Declined', bg: 'rgba(239, 68, 68, 0.12)', color: colors.danger };
    case 'expired':
      return { label: 'Expired', bg: 'rgba(107, 114, 128, 0.12)', color: colors.textMuted };
    case 'superseded':
      return { label: 'Superseded', bg: 'rgba(107, 114, 128, 0.1)', color: colors.textMuted };
    default:
      return { label: status, bg: 'rgba(229, 231, 235, 0.9)', color: colors.textMuted };
  }
}

function formatProposalSnippet(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

const SAVE_BTN_GRADIENT = [colors.primary, colors.secondary] as const;

/** Outline “Save plan” vs solid “Saved” — separate trees avoid bleed after unsave. */
function PlanSaveButtonContent({ saved }: { saved: boolean }) {
  if (saved) {
    return (
      <LinearGradient
        colors={[...SAVE_BTN_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.dualSaveFilled}
      >
        <Text style={styles.dualSaveLabelActive}>Saved</Text>
      </LinearGradient>
    );
  }
  return (
    <LinearGradient
      colors={[...SAVE_BTN_GRADIENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.dualSaveGradientRing}
    >
      <View style={styles.dualSaveInner}>
        <Text style={styles.dualSaveLabel}>Save plan</Text>
      </View>
    </LinearGradient>
  );
}

export default function PlanOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, dbUser, profile: viewerProfile, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(() => (id ? peekPlanDetailSeed(id) : null));
  const [offers, setOffers] = useState<DbPlanOffer[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>({});
  const [gateOpen, setGateOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyBoost, setBusyBoost] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [reportPlanOpen, setReportPlanOpen] = useState(false);
  const [completionSelfAcked, setCompletionSelfAcked] = useState(false);
  const [extendBusy, setExtendBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);
  const [saveUpgradeOpen, setSaveUpgradeOpen] = useState(false);
  const [saveUpgradeTier, setSaveUpgradeTier] = useState<SubscriptionTier>('SILVER');

  const isCreatorEarly = !!(plan && user?.id && plan.creator_id === user.id);
  const { allowed: canSeeInterest } = usePermission('plans.see_all_likes', {
    skip: !isCreatorEarly,
  });
  const { allowed: canExtendMood } = usePermission('mood_plan.extend', {
    skip: !plan?.is_mood_plan,
  });

  const showFeedback = useCallback(
    (variant: AppFeedbackVariant, title: string, message: string) => {
      setFeedback({ variant, title, message });
    },
    []
  );

  useEffect(() => {
    if (!id) {
      setPlan(null);
      return;
    }
    setPlan(peekPlanDetailSeed(id));
  }, [id]);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) return;
    setOffersLoaded(false);
    setCompletionSelfAcked(false);
    const { data: p } = await supabase.from('plans').select('*').eq('id', id).single();
    if (p) {
      const next = p as DbPlan;
      setPlan(next);
      setPlanDetailSeed(id, next);
      if (user?.id && next.status === 'completed') {
        const { data: ack } = await supabase
          .from('plan_completion_acks')
          .select('user_id')
          .eq('plan_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (ack) setCompletionSelfAcked(true);
      }
    }
    const { data: o } = await supabase
      .from('plan_offers')
      .select('*')
      .eq('plan_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    const offerList = (o ?? []) as DbPlanOffer[];
    setOffers(offerList);
    setOffersLoaded(true);

    if (p) {
      const planRow = p as DbPlan;
      const idSet = new Set<string>([planRow.creator_id]);
      const acc = offerList.find((x) => x.id === planRow.accepted_offer_id);
      if (acc) idSet.add(acc.bidder_id);
      for (const off of offerList) {
        idSet.add(off.bidder_id);
      }
      const { data: profs } = await supabase
        .from('profiles')
        .select(
          'user_id, display_name, avatar_url, verified_badge, latitude, longitude, location_label'
        )
        .in('user_id', [...idSet]);
      const map: Record<string, ProfileMini> = {};
      for (const row of profs ?? []) {
        const r = row as ProfileMini;
        map[r.user_id] = r;
      }
      setProfilesById(map);
    }

    if (user?.id) {
      const s = await isPlanSaved(supabase, id, user.id);
      setSaved(s);
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (!id || !user?.id || !plan || plan.creator_id === user.id) return;
      void recordPlanView(supabase, id, user.id);
    }, [id, user?.id, plan])
  );

  const partnerCtx = useMemo(() => {
    if (!plan) return null;
    return planningPartnerContext(plan, user?.id, offers, profilesById);
  }, [plan, user?.id, offers, profilesById]);

  /** Host / match row — `profiles.location_label` only (not plan meetup `location_label`). */
  const partnerLocationLabel = useMemo(() => {
    if (!partnerCtx || partnerCtx.mode !== 'person') return null;
    return partnerCtx.profile?.location_label?.trim() || null;
  }, [partnerCtx]);

  const hostSelfLocationLabel = useMemo(
    () => viewerProfile?.location_label?.trim() || null,
    [viewerProfile?.location_label]
  );

  /** Matched pair: an offer was accepted and the viewer is the host or that offer’s bidder. */
  const viewerIsPlanMatchParty = useMemo(() => {
    if (!plan || !user?.id || !plan.accepted_offer_id) return false;
    if (plan.creator_id === user.id) return true;
    const accepted = offers.find((o) => o.id === plan.accepted_offer_id);
    return accepted != null && accepted.bidder_id === user.id;
  }, [plan, user?.id, offers]);

  const shell = (inner: ReactNode) => (
    <Screen
      safeAreaEdges={['top', 'left', 'right']}
      safeAreaStyle={styles.screenTransparent}
      style={styles.screenTransparent}
    >
      <View style={styles.shell}>
        <LinearGradient
          colors={[colors.discoveryGradientTop, colors.discoveryGradientMid, colors.discoveryGradientBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <PlanStackScreenHeader
          title="Meetup details"
          right={
            user?.id && plan && plan.creator_id !== user.id ? (
              <PlanReportFlagButton onPress={() => setReportPlanOpen(true)} />
            ) : null
          }
        />
        {inner}
        {user?.id && plan ? (
          <ReportSheet
            visible={reportPlanOpen}
            onClose={() => setReportPlanOpen(false)}
            reporterId={user.id}
            reportedUserId={plan.creator_id}
            contentType="plan"
            contentId={plan.id}
            title="Report plan"
          />
        ) : null}
      </View>
    </Screen>
  );

  if (!plan && id) {
    return shell(
      <PlanScreenLoading title="Loading plan" subtitle="Hang tight — we’re fetching this plan and recent offers." />
    );
  }

  if (!plan) {
    return shell(
      <View style={styles.centerState}>
        <Text style={styles.centerTitle}>Plan not found</Text>
        <Text style={styles.centerSub}>This plan may have been removed or the link is outdated.</Text>
      </View>
    );
  }

  const isCreator = plan.creator_id === user?.id;
  const moodClosed = isPlanMoodWindowClosed(plan);
  const moodShelfCopy = planExpiryReason(plan);
  const when = formatPlanWhen(plan);
  const price = formatPlanPrice(plan);
  const boosted =
    plan.boosted_until != null && new Date(plan.boosted_until).getTime() > Date.now();
  const canCalendar = planCanAddToCalendar(plan);

  function goNegotiate() {
    if (!isCreator && requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (plan && id) setPlanDetailSeed(id, plan);
    router.push(`/plan/${id}/negotiate` as Href);
  }

  function goAgreement() {
    router.push(`/plan/${id}/agreement` as Href);
  }

  async function openPlanCounterpartyChat() {
    if (!user || !plan) return;
    const acc = offers.find((o) => o.id === plan.accepted_offer_id);
    if (!acc) {
      showFeedback('warning', 'Chat', 'Could not find the accepted offer. Try refreshing this screen.');
      return;
    }
    const other = plan.creator_id === user.id ? acc.bidder_id : plan.creator_id;
    try {
      await openDirectChat(supabase, user.id, other);
    } catch (e) {
      showFeedback('error', 'Chat', e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  async function toggleSave() {
    if (!user?.id || !plan) return;
    const perm = await checkPermission(user.id, 'plans.bookmark');
    if (!perm.allowed) {
      setSaveUpgradeTier(perm.upgradeTo ?? 'SILVER');
      setSaveUpgradeOpen(true);
      return;
    }
    const next = !saved;
    const { error } = await setPlanSaved(supabase, plan.id, user.id, next);
    if (error) showFeedback('error', 'Save', error);
    else setSaved(next);
  }

  async function onExtendMoodPlan() {
    if (!user?.id || !plan?.id || extendBusy) return;
    setExtendBusy(true);
    const result = await extendMoodPlan(plan.id, user.id);
    setExtendBusy(false);
    if (!result.extended) {
      showFeedback('warning', 'Extend', result.reason ?? 'Could not extend this plan.');
      return;
    }
    showFeedback(
      'success',
      'Extended',
      result.new_expires_at
        ? `Plan extended until ${new Date(result.new_expires_at).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
          })}`
        : 'Plan extended by 24 hours.'
    );
    void load();
  }

  async function onConfirmAttendance() {
    if (!user?.id || !id || !plan || plan.status !== 'completed') return;
    const { error } = await insertPlanCompletionAck(supabase, id, user.id);
    if (error) showFeedback('error', 'Could not save', error);
    else {
      setCompletionSelfAcked(true);
      showFeedback(
        'success',
        'Thanks',
        'When both people confirm, contact sharing outside LinkUp is allowed for this plan.'
      );
    }
  }

  async function onAddToCalendar() {
    if (!plan || !canCalendar) {
      showFeedback(
        'warning',
        'No date yet',
        'Once this plan has a scheduled time, you can tap here to save a reminder in your calendar.'
      );
      return;
    }
    setCalendarBusy(true);
    const r = await addPlanToDeviceCalendar(plan);
    setCalendarBusy(false);
    if (r.ok) {
      showFeedback('success', 'Calendar', 'You can adjust the reminder in your calendar app.');
    } else {
      showFeedback('error', 'Calendar', r.message);
    }
  }

  const agreed =
    plan.status === 'agreed' ||
    plan.status === 'awaiting_payment' ||
    plan.status === 'active' ||
    plan.status === 'completed';

  const guestAgreedCalendarSaveRow = viewerIsPlanMatchParty && agreed && !isCreator;

  return shell(
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
      />
      <UpgradePrompt
        visible={saveUpgradeOpen}
        feature="plans.bookmark"
        requiredTier={saveUpgradeTier}
        onUpgrade={() => {
          setSaveUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setSaveUpgradeOpen(false)}
      />
      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'success'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
      />

      {moodClosed ? (
        <ExpiredPlanShelfBanner
          expiredAtIso={plan.auto_expiry_at ?? plan.mood_expires_at}
          subtitle={moodShelfCopy}
        />
      ) : null}

      <View style={[styles.heroCard, moodClosed && { opacity: 0.88 }]}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroAccent}
        />
        <View style={styles.heroInner}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{plan.title}</Text>
            {plan.is_group_plan ? (
              <View style={styles.groupPill}>
                <Text style={styles.groupPillTxt}>Group</Text>
              </View>
            ) : null}
            {boosted ? (
              <LinearGradient
                colors={[colors.secondary, '#ff8ba0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.boostPill}
              >
                <Text style={styles.boostPillTxt}>Boosted</Text>
              </LinearGradient>
            ) : null}
          </View>
          {plan.description ? <Text style={styles.desc}>{plan.description}</Text> : null}

          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <View style={[styles.metaIcon, { backgroundColor: 'rgba(108,99,255,0.15)' }]}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>When</Text>
                <Text style={styles.metaVal}>{when}</Text>
              </View>
            </View>
            {plan.location_label ? (
              <View style={styles.metaRow}>
                <View style={[styles.metaIcon, { backgroundColor: 'rgba(255,101,132,0.15)' }]}>
                  <Ionicons name="location" size={18} color={colors.secondary} />
                </View>
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>Where</Text>
                  <Text style={styles.metaVal}>{plan.location_label}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <View style={[styles.metaIcon, { backgroundColor: 'rgba(108,99,255,0.12)' }]}>
                <Ionicons name="pricetag" size={18} color={colors.primary} />
              </View>
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Price</Text>
                <Text style={styles.metaVal}>{price ?? 'Open to offers'}</Text>
              </View>
            </View>
          </View>

          <LinearGradient
            colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.statusPill}
          >
            <Text style={styles.statusText}>Status · {plan.status}</Text>
          </LinearGradient>
        </View>
      </View>

      {isCreator && plan.is_mood_plan && !moodClosed && (plan.status === 'negotiating' || plan.status === 'agreed') ? (
        <Pressable
          onPress={() => void onExtendMoodPlan()}
          disabled={
            extendBusy ||
            !canExtendMood ||
            (plan.extension_count ?? 0) >= 1 && plan.host_tier !== 'PLATINUM'
          }
          style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.extendBtnTxt}>
            {extendBusy
              ? 'Extending…'
              : !canExtendMood
                ? 'Extend (Gold+)'
                : (plan.extension_count ?? 0) >= 1 && plan.host_tier !== 'PLATINUM'
                  ? 'Extension used'
                  : 'Extend plan'}
          </Text>
        </Pressable>
      ) : null}

      <PlanGroupGuestsPanel plan={plan} hostUserId={plan.creator_id} currentUserId={user?.id} />
      {isCreator && user?.id ? (
        <PlanInterestedStrip planId={plan.id} hostUserId={plan.creator_id} currentUserId={user.id} />
      ) : null}

      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.peopleSectionBorder}
      >
        <View style={styles.peopleSectionInner}>
          <Text style={styles.peopleSectionTitle}>Planning together</Text>
          <Text style={styles.peopleSectionSub}>
            {partnerCtx?.mode === 'hosting'
              ? 'When you accept an offer, you’ll see who you’re meeting here.'
              : 'The person behind this meetup — tap to view their profile.'}
          </Text>
          {partnerCtx?.mode === 'hosting' ? (
            <>
              <View style={styles.hostingHint}>
                <Ionicons name="people-outline" size={22} color={colors.primary} />
                <Text style={styles.hostingHintTxt}>
                  You’re hosting this plan. Interested people will send offers — then you can match and chat.
                </Text>
              </View>
              {hostSelfLocationLabel ? (
                <PlanningTogetherLocationChip prefix="Host location" location={hostSelfLocationLabel} />
              ) : null}
            </>
          ) : partnerCtx?.mode === 'person' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/user/${partnerCtx.otherUserId}` as Href)}
              style={({ pressed }) => [styles.personRow, pressed && { opacity: 0.92 }]}
            >
              <Avatar
                uri={partnerCtx.profile?.avatar_url}
                name={partnerCtx.profile?.display_name ?? 'Member'}
                size={52}
              />
              <View style={styles.personMeta}>
                <View style={styles.personNameRow}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {partnerCtx.profile?.display_name?.trim() || 'Member'}
                  </Text>
                  {partnerCtx.profile?.verified_badge ? (
                    <VerificationBadge verified variant="chip" />
                  ) : null}
                </View>
                <Text style={styles.personRole}>{partnerCtx.roleLabel}</Text>
                {partnerLocationLabel ? (
                  <PlanningTogetherLocationChip
                    prefix={
                      partnerCtx.otherUserId === plan.creator_id ? 'Host location' : 'Their location'
                    }
                    location={partnerLocationLabel}
                  />
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
                style={styles.personChevron}
              />
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>

      {guestAgreedCalendarSaveRow ? (
        <View style={styles.dualActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void onAddToCalendar()}
            disabled={calendarBusy || !canCalendar}
            style={({ pressed }) => [
              styles.calendarBtnHalf,
              (!canCalendar || calendarBusy) && styles.calendarBtnDisabled,
              pressed && canCalendar && !calendarBusy && { opacity: 0.92 },
            ]}
          >
            <LinearGradient
              colors={canCalendar ? [colors.primary, colors.secondary] : [colors.border, colors.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.calendarBtnGradientHalf}
            >
              {calendarBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={20} color="#fff" />
                  <Text style={styles.calendarBtnTxtHalf} numberOfLines={2}>
                    {canCalendar ? 'Add to calendar' : 'Set a time first'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleSave()}
            style={({ pressed }) => [styles.dualActionFlex, pressed && { opacity: 0.92 }]}
          >
            <PlanSaveButtonContent key={saved ? 'saved' : 'outline'} saved={saved} />
          </Pressable>
        </View>
      ) : viewerIsPlanMatchParty ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void onAddToCalendar()}
          disabled={calendarBusy || !canCalendar}
          style={({ pressed }) => [
            styles.calendarBtn,
            (!canCalendar || calendarBusy) && styles.calendarBtnDisabled,
            pressed && canCalendar && !calendarBusy && { opacity: 0.92 },
          ]}
        >
          <LinearGradient
            colors={canCalendar ? [colors.primary, colors.secondary] : [colors.border, colors.border]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.calendarBtnGradient}
          >
            {calendarBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={22} color="#fff" />
                <Text style={styles.calendarBtnTxt}>
                  {canCalendar ? 'Add to calendar' : 'Add to calendar (set a time first)'}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      ) : null}

      {isCreator ? (
        <View style={styles.rowBtns}>
          <PlanBoostControls
            planId={plan.id}
            creatorId={plan.creator_id}
            dbUser={dbUser}
            boosted={boosted}
            moodClosed={moodClosed}
            onBoosted={() => void load()}
            onShowFeedback={(title, message) => showFeedback('success', title, message)}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              canSeeInterest
                ? router.push(`/plan/${id}/interest` as Href)
                : router.push('/subscription' as Href)
            }
            style={({ pressed }) => [styles.creatorActionFlex, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dualSaveGradientRing}
            >
              <View style={styles.creatorOutlineInner}>
                <Text style={styles.dualSaveLabel} numberOfLines={2} adjustsFontSizeToFit>
                  {canSeeInterest ? 'Who is interested?' : 'Interest (Gold+)'}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      ) : agreed ? (
        guestAgreedCalendarSaveRow ? null : (
          <View style={styles.primaryBtn}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void toggleSave()}
              style={({ pressed }) => [styles.dualSaveFullWidth, pressed && { opacity: 0.92 }]}
            >
              <PlanSaveButtonContent key={saved ? 'saved' : 'outline'} saved={saved} />
            </Pressable>
          </View>
        )
      ) : (
        <View style={styles.dualActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleSave()}
            style={({ pressed }) => [styles.dualActionFlex, pressed && { opacity: 0.92 }]}
          >
            <PlanSaveButtonContent key={saved ? 'saved' : 'outline'} saved={saved} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={goNegotiate}
            disabled={moodClosed}
            style={({ pressed }) => [
              styles.dualActionFlex,
              moodClosed && styles.dualOfferMuted,
              pressed && !moodClosed && { opacity: 0.92 },
            ]}
          >
            <LinearGradient
              colors={
                moodClosed ? [colors.border, colors.border] : [colors.primary, colors.secondary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dualOfferGradient}
            >
              <Text
                style={[styles.dualOfferLabel, moodClosed && styles.dualOfferLabelMuted]}
              >
                Make Offer
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {agreed ? (
        <>
          {user ? (
            <View style={styles.dualActionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={goAgreement}
                style={({ pressed }) => [styles.dualActionFlex, pressed && { opacity: 0.92 }]}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.dualSaveGradientRing, styles.agreementRingFill]}
                >
                  <View style={styles.agreementOutlineInner}>
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    <Text style={styles.agreementOutlineTxt} numberOfLines={2}>
                      View agreement
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void openPlanCounterpartyChat()}
                style={({ pressed }) => [styles.dualActionFlex, pressed && { opacity: 0.92 }]}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.agreementMessageGrad}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.agreementMessageTxt} numberOfLines={1}>
                    Message
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={goAgreement}
              style={({ pressed }) => [
                styles.creatorManageCta,
                pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
              ]}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.creatorManageGrad}
              >
                <Ionicons name="document-text-outline" size={22} color="#FFFFFF" />
                <Text style={styles.creatorManageTxt}>View agreement</Text>
              </LinearGradient>
            </Pressable>
          )}
          {partnerCtx?.mode === 'person' && user ? (
            <>
              {plan.status === 'completed' && !completionSelfAcked ? (
                <Button
                  title="I attended — confirm for safety unlock"
                  variant="secondary"
                  onPress={() => void onConfirmAttendance()}
                  style={styles.primaryBtn}
                  pill
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : isCreator ? (
        <Pressable
          accessibilityRole="button"
          onPress={goNegotiate}
          disabled={moodClosed && !isCreator}
          style={({ pressed }) => [
            styles.creatorManageCta,
            pressed && !(moodClosed && !isCreator) && { opacity: 0.94, transform: [{ scale: 0.985 }] },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.creatorManageGrad}
          >
            <Ionicons name="file-tray-stacked-outline" size={22} color="#FFFFFF" />
            <Text style={styles.creatorManageTxt}>Manage offers</Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      <View style={styles.offersSectionWrap}>
        <View style={styles.offersSectionCard}>
          <View style={styles.offersSectionHeader}>
            <View style={styles.offersSectionTitleRow}>
              <Text style={styles.offersSectionTitle}>Recent offers</Text>
              {offersLoaded && offers.length > 0 ? (
                <View style={styles.offersCountPill}>
                  <Text style={styles.offersCountPillText}>{offers.length}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.offersSectionSubtitle}>
              {isCreator
                ? 'Everyone who has put forward an offer on this plan.'
                : 'Latest activity from people interested in this plan.'}
            </Text>
          </View>

          {!offersLoaded ? (
            <View style={styles.offersLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.offersLoadingHint}>Loading offers…</Text>
            </View>
          ) : offers.length === 0 ? (
            <View style={styles.offersEmpty}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.offersEmptyIconGrad}
              >
                <Ionicons name="pricetags-outline" size={30} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.offersEmptyTitle}>No offers yet</Text>
              <Text style={styles.offersEmptyBody}>
                {isCreator
                  ? 'Share your plan or stay on this screen — when someone sends an offer, you’ll see the details here.'
                  : 'Be the first to make an offer, or check back as others join the conversation.'}
              </Text>
            </View>
          ) : (
            <View style={styles.offersList}>
              {offers.map((item, index) => {
                const chip = offerStatusChip(item.status);
                const matched = plan.accepted_offer_id === item.id;
                const prof = profilesById[item.bidder_id];
                const bidderName =
                  user?.id === item.bidder_id ? 'You' : prof?.display_name?.trim() || 'Member';
                const amountLabel =
                  item.amount_cents != null
                    ? `${(item.amount_cents / 100).toFixed(0)} ${plan.currency}`
                    : 'Open amount';
                const whenProposal = formatProposalSnippet(item.proposed_scheduled_at);
                const proposalLine = [item.proposed_location?.trim(), whenProposal].filter(Boolean).join(' · ');
                return (
                  <View key={item.id}>
                    {index > 0 ? <View style={styles.offerRowDivider} /> : null}
                    <View
                      style={[
                        styles.offerRow,
                        matched && styles.offerRowHighlight,
                      ]}
                    >
                      <Avatar uri={prof?.avatar_url} name={bidderName} size={44} />
                      <View style={styles.offerRowBody}>
                        <View style={styles.offerRowTop}>
                          <Text style={styles.offerRowName} numberOfLines={1}>
                            {bidderName}
                          </Text>
                          <Text style={styles.offerRowTime}>
                            {formatRelativeShort(item.created_at)}
                          </Text>
                        </View>
                        <View style={styles.offerRowMid}>
                          <Text style={styles.offerRowAmount} numberOfLines={1}>
                            {amountLabel}
                          </Text>
                          <View style={[styles.offerStatusPill, { backgroundColor: chip.bg }]}>
                            <Text style={[styles.offerStatusPillText, { color: chip.color }]}>
                              {chip.label}
                            </Text>
                          </View>
                        </View>
                        {matched ? (
                          <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.offerMatchRibbon}
                          >
                            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                            <Text style={styles.offerMatchRibbonText}>Matched on this plan</Text>
                          </LinearGradient>
                        ) : null}
                        {proposalLine ? (
                          <View style={styles.offerProposalRow}>
                            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                            <Text style={styles.offerProposalText} numberOfLines={2}>
                              {proposalLine}
                            </Text>
                          </View>
                        ) : null}
                        {item.message?.trim() ? (
                          <Text style={styles.offerRowMessage} numberOfLines={3}>
                            {item.message.trim()}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent' },
  shell: { flex: 1, position: 'relative' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  centerSub: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  heroCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  heroAccent: { height: 5, width: '100%' },
  heroInner: { padding: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, flex: 1, letterSpacing: -0.5 },
  boostPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
  },
  boostPillTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  groupPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.15)',
  },
  groupPillTxt: { fontSize: 11, fontWeight: '900', color: colors.primary },
  extendBtn: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    alignItems: 'center',
  },
  extendBtnTxt: { fontSize: 14, fontWeight: '800', color: '#B45309' },
  desc: { fontSize: 15, color: colors.textMuted, marginTop: 10, lineHeight: 22 },
  metaBlock: { marginTop: spacing.md, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 },
  metaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaTextCol: { flex: 1, minWidth: 0 },
  metaLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  metaVal: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2, lineHeight: 22 },
  statusPill: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
  },
  statusText: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'capitalize' },
  peopleSectionBorder: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.md,
  },
  peopleSectionInner: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl - 1,
    padding: spacing.lg,
  },
  peopleSectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  peopleSectionSub: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  hostingHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  hostingHintTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  personMeta: { flex: 1, minWidth: 0 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  personName: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  personRole: { fontSize: 13, fontWeight: '700', color: colors.secondary, marginTop: 2 },
  personChevron: { marginTop: 16 },
  calendarBtn: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  calendarBtnHalf: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  calendarBtnDisabled: { opacity: 0.55 },
  calendarBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  calendarBtnGradientHalf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  calendarBtnTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  calendarBtnTxtHalf: { fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'center', flexShrink: 1 },
  agreementOutlineInner: {
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    flex: 1,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  agreementOutlineTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: 'center',
  },
  agreementMessageGrad: {
    flex: 1,
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: spacing.sm,
  },
  agreementMessageTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  primaryBtn: { marginBottom: spacing.sm },
  rowBtns: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  creatorActionFlex: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  creatorActionDisabled: { opacity: 0.55 },
  creatorRowPrimaryGrad: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorRowPrimaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  creatorRowPrimaryTxtMuted: {
    color: colors.textMuted,
  },
  creatorOutlineInner: {
    borderRadius: radius.button - 2,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorManageCta: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
    }),
  },
  creatorManageGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  creatorManageTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  dualActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dualActionFlex: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  dualSaveFullWidth: {
    width: '100%',
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  dualSaveGradientRing: {
    padding: 2,
    borderRadius: radius.button,
  },
  /** Full cell height beside solid gradient (Message) */
  agreementRingFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  dualSaveInner: {
    borderRadius: radius.button - 2,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualSaveFilled: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  dualSaveLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.primary,
  },
  dualSaveLabelActive: {
    color: '#fff',
  },
  dualOfferGradient: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualOfferLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: '#fff',
  },
  dualOfferLabelMuted: {
    color: colors.textMuted,
  },
  dualOfferMuted: { opacity: 0.55 },
  offersSectionWrap: {
    marginTop: spacing.xl + spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.14)',
  },
  offersSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  offersSectionHeader: { marginBottom: spacing.md },
  offersSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  offersSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  offersCountPill: {
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  offersCountPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  offersSectionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  offersLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  offersLoadingHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  offersEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  offersEmptyIconGrad: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  offersEmptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  offersEmptyBody: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  offersList: { marginTop: spacing.xs },
  offerRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    marginVertical: spacing.md,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  offerRowHighlight: {
    backgroundColor: 'rgba(108, 99, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  offerRowBody: { flex: 1, minWidth: 0 },
  offerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  offerRowName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    minWidth: 0,
  },
  offerRowTime: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  offerRowMid: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 6,
  },
  offerRowAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  offerStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
  },
  offerStatusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  offerMatchRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
  },
  offerMatchRibbonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  offerProposalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
  },
  offerProposalText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  offerRowMessage: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 20,
  },
});
