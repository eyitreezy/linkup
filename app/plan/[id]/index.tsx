/**
 * PL4 — plan overview, offers preview, actions, boost & interest (Premium).
 */
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { PlanShareSection } from '@/components/plans/PlanShareSection';
import { PlanReportFlagButton, PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { PlanDetailSkeleton } from '@/components/plans/PlanDetailSkeleton';
import { ActionButtonsSkeleton } from '@/components/plans/ActionButtonsSkeleton';
import { PlanOffersListSkeleton } from '@/components/plans/PlanOffersListSkeleton';
import { ReportSheet } from '@/components/trust/ReportSheet';
import { VerificationBadge } from '@/components/trust/VerificationBadge';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { addPlanToDeviceCalendar, planCanAddToCalendar } from '@/lib/plans/addPlanToDeviceCalendar';
import { ExpiredPlanShelfBanner } from '@/components/plans/ExpiredPlanShelfBanner';
import { PlanningTogetherLocationChip } from '@/components/plans/PlanningTogetherLocationChip';
import { formatPlanAppFee, formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { isPlanMoodWindowClosed, planExpiryReason } from '@/lib/plans/planExpiry';
import { daysUntilIso, isPlanActiveWindowExpiringSoon } from '@/lib/plans/planActiveWindow';
import { isPlanSaved, recordPlanView, setPlanSaved } from '@/lib/plans/planEngagement';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { PlanBoostControls } from '@/components/plans/PlanBoostControls';
import { PlanGroupGuestsPanel } from '@/components/plans/PlanGroupGuestsPanel';
import { PlanInterestedStrip } from '@/components/plans/PlanInterestedStrip';
import { peekPlanDetailSeed, prefetchPlanDetail, setPlanDetailSeed } from '@/lib/plans/planDetailSeed';
import { warmPublicProfileNavigation } from '@/lib/profile/publicProfileSeed';
import {
  peekPlanDetailOffersSeed,
  seedPlanDetailOffers,
} from '@/lib/plans/planDetailOffersSeed';
import { resolveAgreementOfferId, resolvePlanAgreementHref } from '@/lib/plans/planAgreementRoute';
import { isPlanDetailActionReady } from '@/lib/plans/planDetailActionReady';
import { fetchPlanDetailCore } from '@/lib/plans/fetchPlanDetailCore';
import { findMyLatestOffer, usePlanViewerContext } from '@/lib/plans/usePlanViewerContext';
import { fetchMyJoinRequest, submitJoinRequest, fetchGuestEscrowIdForJoinRequest } from '@/lib/plans/joinRequests';
import { RequestJoinSheet } from '@/components/plans/joinRequests/RequestJoinSheet';
import { InviteGuestsSheet } from '@/components/plans/InviteGuestsSheet';
import {
  countPendingInvitations,
  getPlanAvailableSlots,
} from '@/lib/plans/planInvitations';
import { planNegotiateHref } from '@/lib/plans/negotiateRoute';
import { subscribePlanOffersRealtime } from '@/lib/plans/subscribePlanOffersRealtime';
import { extendMoodPlan } from '@/lib/plans/moodPlanCooldown';
import { usePermission } from '@/hooks/usePermission';
import { checkPermission } from '@/lib/subscription/checkPermission';
import type { SubscriptionTier } from '@/types/database';
import { formatRelativeShort } from '@/lib/messaging/formatRelative';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { createGroupChat } from '@/lib/messaging/createGroupChat';
import { insertPlanCompletionAck } from '@/lib/plans/planCompletionAck';
import { isSupabaseConfigured, removeSupabaseChannel, supabase } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlan, DbPlanOffer, JoinRequestStatus, OfferStatus } from '@/types/database';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const accepted =
    offers.find((o) => o.id === plan.accepted_offer_id) ??
    offers.find((o) => o.status === 'accepted');
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
      return { label: 'Pending', bg: 'rgba(94, 82, 255, 0.12)', color: colors.primary };
    case 'countered':
      return { label: 'Countered', bg: 'rgba(255, 74, 114, 0.12)', color: colors.secondary };
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
/** Pill caps for Save plan / Make offer — matches plan detail interest CTAs. */
const PLAN_DUAL_CTA_RADIUS = 300;
const PLAN_DUAL_CTA_MIN_HEIGHT = 52;

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
        <Text style={[styles.dualSaveLabel, styles.dualSaveLabelActive]}>Saved</Text>
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
  const [offers, setOffers] = useState<DbPlanOffer[]>(() =>
    id ? (peekPlanDetailOffersSeed(id) ?? []) : []
  );
  const [offersLoaded, setOffersLoaded] = useState(
    () => Boolean(id && (peekPlanDetailSeed(id) || peekPlanDetailOffersSeed(id)))
  );
  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>({});
  const [gateOpen, setGateOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyBoost, setBusyBoost] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [reportPlanOpen, setReportPlanOpen] = useState(false);
  const [completionSelfAcked, setCompletionSelfAcked] = useState(false);
  const [myJoinRequest, setMyJoinRequest] = useState<{
    id: string;
    status: JoinRequestStatus;
  } | null>(null);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [extendBusy, setExtendBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);
  const [saveUpgradeOpen, setSaveUpgradeOpen] = useState(false);
  const [saveUpgradeTier, setSaveUpgradeTier] = useState<SubscriptionTier>('SILVER');
  const [groupChatConvId, setGroupChatConvId] = useState<string | null>(null);
  const [groupChatBusy, setGroupChatBusy] = useState(false);
  const [interestCount, setInterestCount] = useState(0);
  const [planLoadFailed, setPlanLoadFailed] = useState(false);
  const [availableSlots, setAvailableSlots] = useState(0);
  const [pendingInvitationCount, setPendingInvitationCount] = useState(0);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);

  const offersLoadedRef = useRef(offersLoaded);
  offersLoadedRef.current = offersLoaded;

  const actionContextReady = isPlanDetailActionReady(plan, offers, offersLoaded);

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
      setOffers([]);
      setOffersLoaded(false);
      setPlanLoadFailed(false);
      return;
    }
    setPlan(peekPlanDetailSeed(id));
    const seededOffers = peekPlanDetailOffersSeed(id);
    if (seededOffers) setOffers(seededOffers);
    setOffersLoaded(Boolean(peekPlanDetailSeed(id) || seededOffers));
    setPlanLoadFailed(false);
  }, [id]);

  const loadSecondary = useCallback(
    async (pl: DbPlan, offerList: DbPlanOffer[]) => {
      if (!id) return;

      if (user?.id && pl.status === 'completed') {
        const { data: ack } = await supabase
          .from('plan_completion_acks')
          .select('user_id')
          .eq('plan_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (ack) setCompletionSelfAcked(true);
        else setCompletionSelfAcked(false);
      } else {
        setCompletionSelfAcked(false);
      }

      const idSet = new Set<string>([pl.creator_id]);
      const acc = offerList.find((x) => x.id === pl.accepted_offer_id);
      if (acc) idSet.add(acc.bidder_id);
      for (const off of offerList) idSet.add(off.bidder_id);

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

      if (user?.id) {
        const s = await isPlanSaved(supabase, id, user.id);
        setSaved(s);
      }

      if (user?.id && pl.is_negotiable === false && pl.is_paid) {
        const req = await fetchMyJoinRequest(id, user.id);
        setMyJoinRequest(req);
      } else {
        setMyJoinRequest(null);
      }

      if (user?.id && pl.creator_id === user.id) {
        const [interestRes, slots, pendingInvites] = await Promise.all([
          supabase
            .from('plan_engagements')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', id)
            .in('kind', ['view', 'save']),
          pl.is_group_plan ? getPlanAvailableSlots(id) : Promise.resolve(0),
          pl.is_group_plan ? countPendingInvitations(id) : Promise.resolve(0),
        ]);
        setInterestCount(interestRes.count ?? 0);
        setAvailableSlots(slots);
        setPendingInvitationCount(pendingInvites);
      } else {
        setInterestCount(0);
        setAvailableSlots(0);
        setPendingInvitationCount(0);
      }
    },
    [id, user?.id]
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id || !isSupabaseConfigured) return;

    const hadData =
      offersLoadedRef.current ||
      Boolean(peekPlanDetailSeed(id) || peekPlanDetailOffersSeed(id));

    if (!opts?.silent && !hadData) setOffersLoaded(false);
    if (!opts?.silent) setPlanLoadFailed(false);

    try {
      const { data: core, error } = await fetchPlanDetailCore(supabase, id);
      if (error || !core) {
        if (!hadData) {
          setPlan(null);
          setOffers([]);
        }
        setOffersLoaded(true);
        setPlanLoadFailed(true);
        return;
      }

      setPlan(core.plan);
      setPlanDetailSeed(id, core.plan);
      setOffers(core.offers);
      seedPlanDetailOffers(id, core.offers);
      setOffersLoaded(true);
      setPlanLoadFailed(false);

      void loadSecondary(core.plan, core.offers);
    } catch {
      /* load errors handled above */
    }
  }, [id, loadSecondary]);

  const loadRef = useRef(load);
  loadRef.current = load;

  const applyOfferRealtime = useCallback(
    (payload: { eventType: string; new: DbPlanOffer; old: DbPlanOffer }) => {
      if (!id) return;
      setOffersLoaded(true);
      setOffers((prev) => {
        const { eventType } = payload;
        const newRow = payload.new;
        const oldRow = payload.old;
        let next = prev;

        if (eventType === 'INSERT' && newRow?.id) {
          next = [newRow, ...prev.filter((o) => o.id !== newRow.id)];
        } else if (eventType === 'UPDATE' && newRow?.id) {
          next = prev.map((o) => (o.id === newRow.id ? { ...o, ...newRow } : o));
        } else if (eventType === 'DELETE' && oldRow?.id) {
          next = prev.filter((o) => o.id !== oldRow.id);
        } else {
          return prev;
        }

        next = [...next]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 20);
        seedPlanDetailOffers(id, next);
        return next;
      });
    },
    [id]
  );

  const applyPlanRealtime = useCallback(
    (payload: { eventType: string; new: DbPlan }) => {
      if (!id) return;
      const newRow = payload.new;
      if (newRow?.id !== id) return;
      setPlan(newRow);
      setPlanDetailSeed(id, newRow);
    },
    [id]
  );

  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      prefetchPlanDetail(id);
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        void loadRef.current();
        return;
      }
      void loadRef.current({ silent: true });
    }, [id])
  );

  useEffect(() => {
    firstFocusRef.current = true;
  }, [id]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    return subscribePlanOffersRealtime({
      planId: id,
      onRefresh: () => {
        void loadRef.current({ silent: true });
      },
      onOffersChange: applyOfferRealtime,
      onPlanChange: applyPlanRealtime,
    });
  }, [id, applyOfferRealtime, applyPlanRealtime]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`plan-join-requests-${id}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_join_requests',
          filter: `plan_id=eq.${id}`,
        },
        () => {
          if (user?.id) {
            void fetchMyJoinRequest(id, user.id).then(setMyJoinRequest);
          }
        }
      )
      .subscribe();
    return () => {
      removeSupabaseChannel(channel);
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured || !user?.id) return;
    const channel = supabase
      .channel(`plan-invitations-${id}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_invitations',
          filter: `plan_id=eq.${id}`,
        },
        () => {
          void getPlanAvailableSlots(id).then(setAvailableSlots).catch(() => setAvailableSlots(0));
          void countPendingInvitations(id)
            .then(setPendingInvitationCount)
            .catch(() => setPendingInvitationCount(0));
        }
      )
      .subscribe();
    return () => {
      removeSupabaseChannel(channel);
    };
  }, [id, user?.id]);

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

  const ctx = usePlanViewerContext(plan, user?.id, offers, {
    moodClosed: plan ? isPlanMoodWindowClosed(plan) : false,
    completionSelfAcked,
    myJoinRequest,
  });

  const acceptedOffersSeed = useMemo(
    () => offers.filter((o) => o.status === 'accepted'),
    [offers]
  );

  useEffect(() => {
    if (!plan?.id || !plan.is_group_plan) {
      setGroupChatConvId(null);
      return;
    }
    void supabase
      .from('conversations')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('is_group_chat', true)
      .maybeSingle()
      .then(({ data }) => setGroupChatConvId(data?.id ?? null));
  }, [plan?.id, plan?.is_group_plan]);

  const shell = (inner: ReactNode) => (
    <Screen
      safeAreaEdges={['top', 'left', 'right']}
      safeAreaStyle={styles.screenTransparent}
      style={styles.screenTransparent}
    >
      <View style={styles.shell}>
        <AppShellBackground />
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
    if (planLoadFailed) {
      return shell(
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>Plan not found</Text>
          <Text style={styles.centerSub}>This plan may have been removed or the link is outdated.</Text>
        </View>
      );
    }
    return shell(<PlanDetailSkeleton />);
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
  const showInviteEligible = isCreator && plan.is_group_plan;
  const showPromoteCard =
    isCreator &&
    actionContextReady &&
    !!(ctx?.showBoost || ctx?.showInterest || ctx?.showManageOffers || ctx?.showManageRequests);
  const moodClosed = isPlanMoodWindowClosed(plan);
  const moodShelfCopy = planExpiryReason(plan);
  const when = formatPlanWhen(plan);
  const price = formatPlanPrice(plan);
  const appFee = formatPlanAppFee(plan);
  const boosted =
    plan.boosted_until != null && new Date(plan.boosted_until).getTime() > Date.now();
  const canCalendar = planCanAddToCalendar(plan);

  function goViewOffer() {
    if (!id || !ctx?.myOffer) return;
    if (plan && id) setPlanDetailSeed(id, plan);
    router.push(planNegotiateHref(id, { offerId: ctx.myOffer.id }));
  }

  function goNegotiate() {
    if (!isCreator && requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (plan && id) setPlanDetailSeed(id, plan);
    if (ctx?.showViewOffer) {
      goViewOffer();
      return;
    }
    if (
      ctx?.showViewAgreement &&
      (ctx.isMatchedGuest || (!ctx.showManageOffers && !ctx.showManageRequests))
    ) {
      goAgreement();
      return;
    }
    router.push(`/plan/${id}/negotiate` as Href);
  }

  function goManageRequests() {
    if (!id) return;
    if (plan) setPlanDetailSeed(id, plan);
    router.push(`/plan/${id}/requests` as Href);
  }

  function goViewJoinRequest() {
    if (!id) return;
    router.push(`/plan/${id}/join-request` as Href);
  }

  async function handleSubmitJoinRequest() {
    if (!id || !plan) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    setRequestSubmitting(true);
    try {
      await submitJoinRequest(id, requestMessage.trim() || undefined);
      setRequestSheetOpen(false);
      setRequestMessage('');
      const req = user?.id ? await fetchMyJoinRequest(id, user.id) : null;
      setMyJoinRequest(req);
      Alert.alert(
        'Request sent!',
        'The host will review your request and you will be notified of their decision.'
      );
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setRequestSubmitting(false);
    }
  }

  function goAgreement(offerId?: string) {
    if (!plan || !id) return;
    if (myJoinRequest?.status === 'approved' && user?.id) {
      void fetchGuestEscrowIdForJoinRequest(id, user.id).then((escrowId) => {
        if (escrowId) {
          router.push(`/escrow/${escrowId}` as Href);
          return;
        }
        router.push(`/plan/${id}/agreement` as Href);
      });
      return;
    }
    const resolvedOfferId = resolveAgreementOfferId(plan, user?.id, offers, offerId);
    router.push(
      resolvePlanAgreementHref(plan, {
        offerId: resolvedOfferId,
        userId: user?.id,
        offers,
      })
    );
  }

  async function openHostMessage() {
    if (!user || !plan) return;
    if (plan.is_group_plan) {
      await handleOpenGroupChat();
      return;
    }
    await openPlanCounterpartyChat();
  }

  async function openPlanCounterpartyChat() {
    if (!user || !plan) return;
    const acc =
      offers.find((o) => o.id === plan.accepted_offer_id) ?? findMyLatestOffer(offers, user.id);
    if (!acc) {
      showFeedback('warning', 'Chat', 'Could not find the accepted offer. Try refreshing this screen.');
      return;
    }
    const other = plan.creator_id === user.id ? acc.bidder_id : plan.creator_id;
    try {
      await openDirectChat(supabase, user.id, other, { skipOfferGate: true });
    } catch (e) {
      showFeedback('error', 'Chat', e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  async function handleOpenGroupChat() {
    if (!user?.id || !plan || groupChatBusy) return;
    setGroupChatBusy(true);
    try {
      if (groupChatConvId) {
        router.push(`/chat/group/${groupChatConvId}` as Href);
        return;
      }
      if (plan.creator_id !== user.id) {
        showFeedback('warning', 'Group chat', 'The host has not opened the group chat yet.');
        return;
      }
      const guestIds = offers.filter((o) => o.status === 'accepted').map((o) => o.bidder_id);
      const convId = await createGroupChat({
        planId: plan.id,
        hostId: user.id,
        groupName: plan.title,
        initialMemberIds: guestIds,
      });
      setGroupChatConvId(convId);
      router.push(`/chat/group/${convId}` as Href);
    } catch (e) {
      showFeedback('error', 'Group chat', e instanceof Error ? e.message : 'Could not open group chat');
    } finally {
      setGroupChatBusy(false);
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

  const guestCalendarSaveRow = !isCreator && !!(ctx?.showCalendar && ctx.showSave);

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
      {plan ? (
        <RequestJoinSheet
          visible={requestSheetOpen}
          plan={plan}
          message={requestMessage}
          onChangeMessage={setRequestMessage}
          onClose={() => setRequestSheetOpen(false)}
          onSubmit={() => void handleSubmitJoinRequest()}
          submitting={requestSubmitting}
        />
      ) : null}
      {plan && showInviteEligible ? (
        <InviteGuestsSheet
          visible={inviteSheetOpen}
          planId={plan.id}
          planDetails={{
            name: plan.title?.trim() || 'Meetup',
            hostName: viewerProfile?.display_name?.trim() || 'Host',
            planDate: formatPlanWhen(plan),
            planLocation: plan.location_label ?? undefined,
            shareAmountCents: plan.current_suggested_share_cents ?? undefined,
          }}
          availableSlots={availableSlots}
          onClose={() => setInviteSheetOpen(false)}
          onSlotsChanged={() => {
            void getPlanAvailableSlots(plan.id)
              .then(setAvailableSlots)
              .catch(() => setAvailableSlots(0));
            void countPendingInvitations(plan.id)
              .then(setPendingInvitationCount)
              .catch(() => setPendingInvitationCount(0));
          }}
        />
      ) : null}

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
              <View style={[styles.metaIcon, { backgroundColor: 'rgba(94, 82, 255,0.15)' }]}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>When</Text>
                <Text style={styles.metaVal}>{when}</Text>
              </View>
            </View>
            {plan.location_label ? (
              <View style={styles.metaRow}>
                <View style={[styles.metaIcon, { backgroundColor: 'rgba(255, 74, 114,0.15)' }]}>
                  <Ionicons name="location" size={18} color={colors.secondary} />
                </View>
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>Where</Text>
                  <Text style={styles.metaVal}>{plan.location_label}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <View style={[styles.metaIcon, { backgroundColor: 'rgba(94, 82, 255,0.12)' }]}>
                <Ionicons name="pricetag" size={18} color={colors.primary} />
              </View>
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Price</Text>
                <Text style={styles.metaVal}>{price ?? 'Open to offers'}</Text>
              </View>
            </View>
            {appFee ? (
              <View style={styles.metaRow}>
                <View style={[styles.metaIcon, { backgroundColor: 'rgba(5, 150, 105, 0.12)' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#059669" />
                </View>
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>App fee</Text>
                  <Text style={styles.metaVal}>{appFee}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <LinearGradient
            colors={['rgba(94, 82, 255,0.12)', 'rgba(255, 74, 114,0.12)']}
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

      <PlanGroupGuestsPanel
        plan={plan}
        hostUserId={plan.creator_id}
        currentUserId={user?.id}
        seedAcceptedOffers={acceptedOffersSeed}
        offersReady={actionContextReady}
        refreshKey={`${plan.updated_at ?? ''}:${acceptedOffersSeed.length}:${acceptedOffersSeed.map((o) => o.id).join(',')}`}
        showInvite={showInviteEligible}
        inviteDisabled={moodClosed}
        onInvitePress={() => setInviteSheetOpen(true)}
      />
      {plan.is_group_plan && (plan.status === 'active' || plan.status === 'agreed') &&
      (isCreator || groupChatConvId) ? (
        <Pressable
          onPress={() => void handleOpenGroupChat()}
          disabled={groupChatBusy}
          style={({ pressed }) => [styles.groupChatBtn, pressed && { opacity: 0.92 }]}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
          <Text style={styles.groupChatLabel}>
            {groupChatBusy ? 'Opening…' : 'Group Chat'}
          </Text>
        </Pressable>
      ) : null}
      <PlanShareSection
        plan={plan}
        hostProfile={profilesById[plan.creator_id]}
        currentUserId={user?.id}
      />
      {isCreator && user?.id ? (
        <PlanInterestedStrip planId={plan.id} hostUserId={plan.creator_id} currentUserId={user.id} />
      ) : null}

      {!actionContextReady && !showInviteEligible ? <ActionButtonsSkeleton /> : null}

      {showPromoteCard ? (
        <View style={styles.planActionsCard}>
          <View style={styles.planActionsHeader}>
            <LinearGradient
              colors={[colors.primary, '#8B7CFF', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planActionsIcon}
            >
              <Ionicons name="rocket-outline" size={18} color="#fff" />
            </LinearGradient>
            <View style={styles.planActionsHeaderCopy}>
              <Text style={styles.planActionsTitle}>Promote & manage</Text>
              <Text style={styles.planActionsSub}>Boost visibility, track interest, and handle offers</Text>
            </View>
          </View>
          <View style={styles.planActionGrid}>
          {actionContextReady && ctx?.showBoost ? (
          <PlanBoostControls
            planId={plan.id}
            creatorId={plan.creator_id}
            dbUser={dbUser}
            boosted={boosted}
            boostedUntil={plan.boosted_until}
            planVisibility={plan.visibility}
            boostRadiusKm={plan.boost_radius_km}
            moodClosed={moodClosed}
            onBoosted={() => void load()}
            onShowFeedback={(title, message) => showFeedback('success', title, message)}
            cellStyle={styles.planActionGridCell}
            fullWidthCellStyle={styles.planActionGridCellFull}
          />
          ) : null}
          {actionContextReady && ctx?.showInterest ? (
          <View style={styles.planActionGridCell}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                canSeeInterest
                  ? router.push(`/plan/${id}/interest` as Href)
                  : router.push('/subscription' as Href)
              }
              style={({ pressed }) => [
                styles.planDetailBtnOuter,
                styles.planDetailInterestBtn,
                pressed && { opacity: 0.92 },
              ]}
            >
              <LinearGradient
                colors={
                  canSeeInterest ? [colors.primary, colors.secondary] : [colors.border, colors.border]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.planDetailBtnPrimaryGrad, styles.planDetailInterestBtn]}
              >
                {!canSeeInterest ? (
                  <Ionicons name="lock-closed" size={16} color="#fff" style={{ marginRight: 6 }} />
                ) : null}
                <Ionicons name="eye-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.planDetailBtnPrimaryTxt} numberOfLines={1}>
                  {interestCount > 0 ? String(interestCount) : 'Interest'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
          ) : null}
          {actionContextReady && ctx?.showManageOffers ? (
          <View style={styles.planActionGridCell}>
            <Pressable
              accessibilityRole="button"
              onPress={goNegotiate}
              disabled={moodClosed}
              style={({ pressed }) => [
                styles.planDetailBtnOuter,
                moodClosed && styles.planDetailBtnDisabled,
                pressed && !moodClosed && { opacity: 0.92 },
              ]}
            >
              <LinearGradient
                colors={moodClosed ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.planDetailBtnPrimaryGrad}
              >
                <Ionicons name="file-tray-stacked-outline" size={18} color="#FFFFFF" />
                <Text style={styles.planDetailBtnPrimaryTxt} numberOfLines={1}>
                  Manage offers
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
          ) : null}
          {actionContextReady && ctx?.showManageRequests ? (
          <View style={styles.planActionGridCell}>
            <Pressable
              accessibilityRole="button"
              onPress={goManageRequests}
              disabled={moodClosed}
              style={({ pressed }) => [
                styles.planDetailBtnOuter,
                moodClosed && styles.planDetailBtnDisabled,
                pressed && !moodClosed && { opacity: 0.92 },
              ]}
            >
              <LinearGradient
                colors={moodClosed ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.planDetailBtnPrimaryGrad}
              >
                <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                <Text style={styles.planDetailBtnPrimaryTxt} numberOfLines={1}>
                  Manage requests
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
          ) : null}
        </View>
        </View>
      ) : null}

      {actionContextReady ? (
        <>
      {isCreator && ctx?.showGroupGuestAgreements ? (
        <View style={styles.guestAgreementCard}>
          <Text style={styles.guestAgreementTitle}>Accepted guests</Text>
          {ctx.acceptedGuests.map((guest) => {
            const prof = profilesById[guest.userId];
            const name = prof?.display_name?.trim() || 'Guest';
            return (
              <View key={guest.offerId} style={styles.guestAgreementRow}>
                <Avatar uri={prof?.avatar_url} name={name} size={40} />
                <Text style={styles.guestAgreementName} numberOfLines={1}>
                  {name}
                </Text>
                <View style={styles.guestAgreementActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View agreement for ${name}`}
                    onPress={() => goAgreement(guest.offerId)}
                    style={({ pressed }) => [styles.guestAgreementBtnOuter, pressed && { opacity: 0.92 }]}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.guestAgreementBtnRing}
                    >
                      <View style={styles.guestAgreementBtnInner}>
                        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                        <Text style={styles.guestAgreementBtnTxt}>Agreement</Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${name}`}
                    onPress={async () => {
                      if (!user) return;
                      try {
                        await openDirectChat(supabase, user.id, guest.userId, { skipOfferGate: true });
                      } catch (e) {
                        showFeedback('error', 'Chat', e instanceof Error ? e.message : 'Could not open chat');
                      }
                    }}
                    style={({ pressed }) => [styles.guestMessageBtnOuter, pressed && { opacity: 0.92 }]}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.guestMessageBtnGrad}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {isCreator && ctx?.showViewAgreement && ctx.showMessage && !ctx.showGroupGuestAgreements ? (
        <View style={styles.dualActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => goAgreement()}
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
      ) : null}

      {isCreator && ctx?.showMessage && ctx.showGroupGuestAgreements ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void openHostMessage()}
          disabled={groupChatBusy}
          style={({ pressed }) => [styles.groupChatBtn, pressed && { opacity: 0.92 }]}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
          <Text style={styles.groupChatLabel}>
            {groupChatBusy ? 'Opening…' : 'Message group'}
          </Text>
        </Pressable>
      ) : null}

      {isCreator && plan.active_expires_at && !plan.is_mood_plan ? (
        <View
          style={[
            styles.activeWindowRow,
            isPlanActiveWindowExpiringSoon(plan.active_expires_at) && styles.activeWindowRowWarn,
          ]}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={
              isPlanActiveWindowExpiringSoon(plan.active_expires_at)
                ? colors.warning
                : colors.textMuted
            }
          />
          <Text
            style={[
              styles.activeWindowText,
              isPlanActiveWindowExpiringSoon(plan.active_expires_at) && styles.activeWindowTextWarn,
            ]}
          >
            {isPlanActiveWindowExpiringSoon(plan.active_expires_at)
              ? `Listing expires in ${daysUntilIso(plan.active_expires_at)} days`
              : `Listed until ${new Date(plan.active_expires_at).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}`}
          </Text>
        </View>
      ) : null}
        </>
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
              : 'The person behind this meetup. Tap to view their profile.'}
          </Text>
          {partnerCtx?.mode === 'hosting' ? (
            <>
              <View style={styles.hostingHint}>
                <Ionicons name="people-outline" size={22} color={colors.primary} />
                <Text style={styles.hostingHintTxt}>
                  You’re hosting this plan. Interested people will send offers, then you can match and chat.
                </Text>
              </View>
              {hostSelfLocationLabel ? (
                <PlanningTogetherLocationChip prefix="Host location" location={hostSelfLocationLabel} />
              ) : null}
            </>
          ) : partnerCtx?.mode === 'person' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                warmPublicProfileNavigation(partnerCtx.otherUserId, {
                  user_id: partnerCtx.otherUserId,
                  display_name: partnerCtx.profile?.display_name ?? null,
                  avatar_url: partnerCtx.profile?.avatar_url ?? null,
                  verified_badge: partnerCtx.profile?.verified_badge ?? false,
                  location_label: partnerCtx.profile?.location_label ?? null,
                  latitude: partnerCtx.profile?.latitude ?? null,
                  longitude: partnerCtx.profile?.longitude ?? null,
                });
                router.push(`/user/${partnerCtx.otherUserId}` as Href);
              }}
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

      {actionContextReady ? (
        <>
      {!isCreator && ctx?.showSave && ctx.showMakeOffer ? (
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
              <Text style={[styles.dualOfferLabel, moodClosed && styles.dualOfferLabelMuted]}>
                Make Offer
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      {!isCreator && ctx?.showSave && ctx.showRequestToJoin ? (
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
            onPress={() => setRequestSheetOpen(true)}
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
              <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={[styles.dualOfferLabel, moodClosed && styles.dualOfferLabelMuted]}>
                Request to join
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      {!isCreator && ctx?.showSave && ctx.showViewRequest ? (
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
            onPress={goViewJoinRequest}
            style={({ pressed }) => [styles.dualActionFlex, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dualOfferGradient}
            >
              <Ionicons name="time-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.dualOfferLabel}>View request</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      {!isCreator && ctx?.showSave && ctx.showViewOffer ? (
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
            onPress={goViewOffer}
            style={({ pressed }) => [styles.dualActionFlex, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dualOfferGradient}
            >
              <Text style={styles.dualOfferLabel}>View offer</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      {!isCreator && guestCalendarSaveRow ? (
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
                  <Text
                    style={styles.calendarBtnTxtHalf}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
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
      ) : null}

      {!isCreator &&
      ctx?.showSave &&
      !ctx.showMakeOffer &&
      !ctx.showViewOffer &&
      !ctx.showRequestToJoin &&
      !ctx.showViewRequest &&
      !guestCalendarSaveRow ? (
        <View style={styles.primaryBtn}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleSave()}
            style={({ pressed }) => [styles.dualSaveFullWidth, pressed && { opacity: 0.92 }]}
          >
            <PlanSaveButtonContent key={saved ? 'saved' : 'outline'} saved={saved} />
          </Pressable>
        </View>
      ) : null}

      {!isCreator && ctx?.showViewAgreement && ctx.showMessage ? (
        <View style={styles.dualActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => goAgreement()}
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
      ) : null}

      {ctx?.showConfirmAttendance ? (
        <Button
          title="Confirm attendance for safety unlock"
          variant="secondary"
          onPress={() => void onConfirmAttendance()}
          style={styles.primaryBtn}
          pill
        />
      ) : null}
        </>
      ) : null}

      <View style={styles.offersSectionWrap}>
        <View style={styles.offersSectionCard}>
          <View style={styles.offersSectionHeader}>
            <View style={styles.offersSectionTitleRow}>
              <Text style={styles.offersSectionTitle}>Recent offers</Text>
              {actionContextReady && offers.length > 0 ? (
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

          {!actionContextReady ? (
            <PlanOffersListSkeleton />
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
                  ? 'Share your plan or stay here. New offers will appear in this list.'
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
  centerTitle: { fontSize: 18, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  centerSub: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
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
  title: { fontSize: 24, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, flex: 1, letterSpacing: -0.5 },
  boostPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
  },
  boostPillTxt: { fontSize: 12, fontWeight: '800',
    fontFamily: fonts.bold, color: '#fff' },
  groupPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255,0.15)',
  },
  groupPillTxt: { fontSize: 11, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.primary },
  groupChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  groupChatLabel: { fontSize: 15, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary },
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
  extendBtnTxt: { fontSize: 14, fontWeight: '800',
    fontFamily: fonts.bold, color: '#B45309' },
  desc: { fontSize: 15, color: colors.textMuted, marginTop: 10, lineHeight: 22, fontFamily: fonts.regular, },
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
  metaLabel: { fontSize: 12, fontWeight: '700',
    fontFamily: fonts.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  metaVal: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2, lineHeight: 22, fontFamily: fonts.medium, },
  statusPill: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
  },
  statusText: { fontSize: 13, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary, textTransform: 'capitalize' },
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
  peopleSectionTitle: { fontSize: 18, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text },
  peopleSectionSub: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20, fontFamily: fonts.regular, },
  hostingHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(94, 82, 255,0.08)',
  },
  hostingHintTxt: { flex: 1, fontSize: 14, fontWeight: '600',
    fontFamily: fonts.medium, color: colors.text, lineHeight: 20 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  personMeta: { flex: 1, minWidth: 0 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  personName: { fontSize: 17, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, flexShrink: 1 },
  personRole: { fontSize: 13, fontWeight: '700', color: colors.secondary, marginTop: 2, fontFamily: fonts.medium, },
  personChevron: { marginTop: 16 },
  calendarBtn: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    height: PLAN_DUAL_CTA_MIN_HEIGHT,
  },
  calendarBtnHalf: {
    flex: 1,
    minWidth: 0,
    borderRadius: PLAN_DUAL_CTA_RADIUS,
    overflow: 'hidden',
    height: PLAN_DUAL_CTA_MIN_HEIGHT,
    alignSelf: 'stretch',
  },
  calendarBtnDisabled: { opacity: 0.55 },
  calendarBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    height: PLAN_DUAL_CTA_MIN_HEIGHT,
  },
  calendarBtnGradientHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: PLAN_DUAL_CTA_MIN_HEIGHT,
  },
  calendarBtnTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    flexShrink: 1,
  },
  calendarBtnTxtHalf: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    flexShrink: 1,
    fontFamily: fonts.bold,
  },
  agreementOutlineInner: {
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    flex: 1,
    minHeight: 48,
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
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: 'center',
  },
  agreementMessageGrad: {
    flex: 1,
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  agreementMessageTxt: { fontSize: 14, fontWeight: '800',
    fontFamily: fonts.bold, color: '#FFFFFF', letterSpacing: -0.2 },
  primaryBtn: { marginBottom: spacing.sm },
  planActionsCard: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    padding: spacing.md,
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  planActionsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(94, 82, 255, 0.1)',
  },
  planActionsIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planActionsHeaderCopy: { flex: 1, minWidth: 0 },
  planActionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  planActionsSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
  },
  planActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 4,
  },
  guestAgreementCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(216, 220, 230, 0.9)',
  },
  guestAgreementTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  guestAgreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(94, 82, 255, 0.1)',
  },
  guestAgreementName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
    minWidth: 0,
  },
  guestAgreementActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  guestAgreementBtnOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  guestAgreementBtnRing: {
    padding: 2,
    borderRadius: radius.button,
  },
  guestAgreementBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.button - 2,
    backgroundColor: colors.surface,
  },
  guestAgreementBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  guestMessageBtnOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  guestMessageBtnGrad: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWindowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(107, 114, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.14)',
  },
  activeWindowRowWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  activeWindowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  activeWindowTextWarn: {
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.warning,
  },
  planActionGridCell: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 148,
  },
  planActionGridCellFull: {
    flexBasis: '100%',
    width: '100%',
  },
  planDetailBtnOuter: {
    width: '100%',
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  planDetailInterestBtn: {
    borderRadius: 300,
  },
  planDetailBtnPrimaryGrad: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
  },
  planDetailBtnPrimaryTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  planDetailBtnDisabled: { opacity: 0.55 },
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
        shadowColor: '#5E52FF',
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
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  creatorManageTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
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
    borderRadius: PLAN_DUAL_CTA_RADIUS,
    overflow: 'hidden',
    minHeight: PLAN_DUAL_CTA_MIN_HEIGHT,
  },
  dualSaveFullWidth: {
    width: '100%',
    borderRadius: PLAN_DUAL_CTA_RADIUS,
    overflow: 'hidden',
    minHeight: PLAN_DUAL_CTA_MIN_HEIGHT,
  },
  dualSaveGradientRing: {
    padding: 2,
    borderRadius: PLAN_DUAL_CTA_RADIUS,
    minHeight: PLAN_DUAL_CTA_MIN_HEIGHT,
  },
  /** Full cell height beside solid gradient (Message) */
  agreementRingFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  dualSaveInner: {
    borderRadius: PLAN_DUAL_CTA_RADIUS - 2,
    backgroundColor: '#FFFFFF',
    minHeight: PLAN_DUAL_CTA_MIN_HEIGHT - 4,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualSaveFilled: {
    minHeight: PLAN_DUAL_CTA_MIN_HEIGHT,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PLAN_DUAL_CTA_RADIUS,
  },
  dualSaveLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
    color: colors.primary,
  },
  dualSaveLabelActive: {
    color: '#fff',
  },
  dualOfferGradient: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minHeight: PLAN_DUAL_CTA_MIN_HEIGHT,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PLAN_DUAL_CTA_RADIUS,
  },
  dualOfferLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
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
    borderTopColor: 'rgba(94, 82, 255, 0.14)',
  },
  offersSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
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
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  offersCountPill: {
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  offersCountPillText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  offersSectionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.medium,
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
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  offersEmptyBody: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  offersList: { marginTop: spacing.xs },
  offerRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
    marginVertical: spacing.md,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  offerRowHighlight: {
    backgroundColor: 'rgba(94, 82, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
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
    fontFamily: fonts.bold,
    color: colors.text,
    minWidth: 0,
  },
  offerRowTime: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.medium,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
  },
  offerRowMessage: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fonts.regular,
    color: colors.text,
    lineHeight: 20,
  },
});
