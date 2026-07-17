/**
 * PL5 — offer timeline with chat-like layout + composer (price, time, note).
 */
import { Button } from '@/components/Button';
import { Input, planCreateTouchableFieldStyle } from '@/components/Input';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { openPlanMeetupChat, PlanMeetupChatError } from '@/lib/messaging/openPlanMeetupChat';
import { checkOfferBeforeChatOnPlan } from '@/lib/messaging/offerBeforeChatGate';
import { GroupSplitHostFooter } from '@/components/plans/negotiation/GroupSplitHostFooter';
import { OfferFeeBreakdown } from '@/components/plans/OfferFeeBreakdown';
import {
  calculateGroupSuggestedShareCents,
  formatGroupSplitCents,
  isGroupSplitPlan,
} from '@/lib/plans/groupSplitDynamic';
import { grossAmountCents } from '@/lib/plans/planFinancialConfig';
import {
  guestRespondToCounter,
  hostRespondToOffer,
  submitOfferOrCounter,
  withdrawOffer,
} from '@/lib/plans/negotiationActions';
import { deriveNegotiationContext, isOfferLive } from '@/lib/plans/negotiationState';
import { resolvePlanAgreementHref, shouldRedirectFromNegotiate } from '@/lib/plans/planAgreementRoute';
import {
  countOffersTowardLimit,
  countOffersTowardLimitForBidder,
  bidderHasActiveGroupSlotOffer,
  isOfferExpired,
  MAX_OFFERS_PER_PLAN,
} from '@/lib/plans/offerRules';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { attachPlanNegotiationRoundsChannels } from '@/lib/plans/subscribePlanNegotiationRealtime';
import { subscribePlanOffersRealtime } from '@/lib/plans/subscribePlanOffersRealtime';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import { useKeyboardAnimation } from '@/hooks/useKeyboardAnimation';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { DropIdeaSheet } from '@/components/plans/negotiation/DropIdeaSheet';
import { NegotiationOfferActions } from '@/components/plans/negotiation/NegotiationOfferActions';
import { negotiationPanelStyles } from '@/components/plans/negotiation/negotiationPanelStyles';
import { OfferCounterSheet } from '@/components/plans/negotiation/OfferCounterSheet';
import { GradientSelectionChip, GRADIENT_CHIP_HEIGHT } from '@/components/ui/GradientSelectionChip';
import { useDraggableSheet } from '@/hooks/useDraggableSheet';
import { useKeyboardStickyFooterMode } from '@/hooks/useKeyboardStickyFooterMode';
import { OfferBubble } from '@/components/plans/negotiation/OfferBubble';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { KeyboardAwareScrollView as ControllerAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  plan: DbPlan;
  initialOfferId?: string | null;
  openCounterOnMount?: boolean;
  onPlanFlowAdvance?: (href: Href) => void;
  onPlanRefresh?: () => void;
};

type QuickSparkId = 'tonight' | 'tomorrow' | 'sat_brunch' | 'public' | 'your_pick' | 'low_key';

const NOTE_SPARK_TONIGHT = 'Tonight at 7pm works for me.';
const NOTE_SPARK_TOMORROW = 'Tomorrow at noon works for me.';
const NOTE_SPARK_SAT_BRUNCH = 'Saturday brunch works for me.';
const NOTE_SPARK_PUBLIC = 'Somewhere public works for me.';
const NOTE_SPARK_YOUR_PICK = 'Happy to try your favorite place nearby.';
const NOTE_SPARK_LOW_KEY = 'Keep it casual. Open to ideas.';

const QUICK_SPARK_NOTES: Record<QuickSparkId, string> = {
  tonight: NOTE_SPARK_TONIGHT,
  tomorrow: NOTE_SPARK_TOMORROW,
  sat_brunch: NOTE_SPARK_SAT_BRUNCH,
  public: NOTE_SPARK_PUBLIC,
  your_pick: NOTE_SPARK_YOUR_PICK,
  low_key: NOTE_SPARK_LOW_KEY,
};

function isTimeQuickSpark(id: QuickSparkId): boolean {
  return id === 'tonight' || id === 'tomorrow' || id === 'sat_brunch';
}

function tonightAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function tomorrowAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function nextSaturdayAt(hour: number, minute: number): Date {
  const d = new Date();
  const day = d.getDay();
  let add = (6 - day + 7) % 7;
  if (add === 0) {
    const trial = new Date(d);
    trial.setHours(hour, minute, 0, 0);
    if (trial.getTime() <= Date.now()) add = 7;
  }
  d.setDate(d.getDate() + add);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function NegotiationChat({ plan, initialOfferId, openCounterOnMount, onPlanFlowAdvance, onPlanRefresh }: Props) {
  const { user, dbUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { typingBackdropStyle, composerLiftStyle } = useKeyboardAnimation({ liftOnAndroid: true });
  const listRef = useRef<FlatList>(null);
  const collapseSheetRef = useRef<() => void>(() => {});
  const [offers, setOffers] = useState<DbPlanOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [activeQuickSpark, setActiveQuickSpark] = useState<QuickSparkId | null>(null);
  const [proposedAt, setProposedAt] = useState<Date | null>(plan.scheduled_at ? new Date(plan.scheduled_at) : null);
  /** iOS only — Android uses imperative DateTimePickerAndroid (datetime JSX breaks dismiss on unmount). */
  const [showTime, setShowTime] = useState(false);
  const [sending, setSending] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [dmGateOpen, setDmGateOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [suggestionSheetVisible, setSuggestionSheetVisible] = useState(false);
  const [counterOffer, setCounterOffer] = useState<DbPlanOffer | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [negotiationRefreshToken, setNegotiationRefreshToken] = useState(0);
  const [suggestedShareCents, setSuggestedShareCents] = useState<number | null>(null);
  const [suggestedSharePrefilled, setSuggestedSharePrefilled] = useState(false);
  const [confirm, setConfirm] = useState<{
    kind: 'accept' | 'decline' | 'withdraw';
    offer: DbPlanOffer;
  } | null>(null);

  const bumpNegotiationRefresh = useCallback(() => {
    setNegotiationRefreshToken((n) => n + 1);
  }, []);

  function showFeedback(variant: AppFeedbackVariant, title: string, message: string) {
    setFeedback({ variant, title, message });
  }

  const planId = plan.id;
  const isCreator = user?.id === plan.creator_id;
  const moodClosed = isPlanMoodWindowClosed(plan);
  const canNegotiate = plan.status === 'negotiating' && !moodClosed;
  const groupSplitPlan = isGroupSplitPlan(plan);
  const offerBudgetCents = useMemo(() => {
    if (!amount.trim()) return 0;
    const n = Number(amount);
    if (Number.isNaN(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [amount]);

  const remainingGuestSlots = Math.max(0, (plan.max_guests ?? 1) - (plan.accepted_guest_count ?? 0));

  const refreshSuggestedShare = useCallback(async () => {
    if (!groupSplitPlan || isCreator || !planId) {
      setSuggestedShareCents(null);
      return;
    }
    const { data } = await supabase
      .from('plans')
      .select(
        'current_suggested_share_cents, starting_price_cents, agreed_price_cents, accepted_guest_amounts_sum_cents, max_guests, accepted_guest_count'
      )
      .eq('id', planId)
      .single();
    if (data) {
      const row = data as DbPlan;
      const cents = row.current_suggested_share_cents ?? calculateGroupSuggestedShareCents(row);
      setSuggestedShareCents(cents);
    }
  }, [groupSplitPlan, isCreator, planId]);

  useEffect(() => {
    void refreshSuggestedShare();
  }, [refreshSuggestedShare, plan.updated_at, plan.accepted_guest_count]);

  useEffect(() => {
    if (!suggestedSharePrefilled && suggestedShareCents && suggestedShareCents > 0 && !amount.trim()) {
      setAmount(String(suggestedShareCents / 100));
      setSuggestedSharePrefilled(true);
    }
  }, [amount, suggestedShareCents, suggestedSharePrefilled]);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setOffersLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('plan_offers')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: true });
      if (data) setOffers(data as DbPlanOffer[]);
    } finally {
      setOffersLoading(false);
    }
  }, [planId]);

  const loadRef = useRef(load);
  loadRef.current = load;

  const applyOfferRealtimeRef = useRef<(payload: RealtimePostgresChangesPayload<DbPlanOffer>) => void>(
    () => {}
  );
  applyOfferRealtimeRef.current = (payload) => {
    const { eventType } = payload;
    const newRow = payload.new as DbPlanOffer | undefined;
    const oldRow = payload.old as DbPlanOffer | undefined;
    setOffers((prev) => {
      if (eventType === 'INSERT' && newRow?.id) {
        const exists = prev.some((o) => o.id === newRow.id);
        if (exists) {
          return prev.map((o) => (o.id === newRow.id ? { ...o, ...newRow } : o));
        }
        return [...prev, newRow].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (eventType === 'UPDATE' && newRow?.id) {
        return prev.map((o) => (o.id === newRow.id ? { ...o, ...newRow } : o));
      }
      if (eventType === 'DELETE' && oldRow?.id) {
        return prev.filter((o) => o.id !== oldRow.id);
      }
      return prev;
    });
    bumpNegotiationRefresh();
  };

  useEffect(() => {
    setOffersLoading(true);
    void load();
  }, [load]);

  const sorted = [...offers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const flowAdvance = useMemo(
    () => shouldRedirectFromNegotiate(plan, user?.id, sorted),
    [plan, user?.id, sorted]
  );

  useEffect(() => {
    if (offersLoading || !flowAdvance.redirect) return;
    onPlanFlowAdvance?.(flowAdvance.href);
  }, [offersLoading, flowAdvance, onPlanFlowAdvance]);

  const liveOffers = useMemo(() => sorted.filter((o) => isOfferLive(o)), [sorted]);

  const guestLiveOffers = useMemo(
    () => (user ? liveOffers.filter((o) => o.bidder_id === user.id) : []),
    [liveOffers, user]
  );

  const hostSelectableOffers = useMemo(
    () => liveOffers.filter((o) => o.bidder_id !== plan.creator_id),
    [liveOffers, plan.creator_id]
  );

  useEffect(() => {
    if (!isCreator) return;
    if (initialOfferId && hostSelectableOffers.some((o) => o.id === initialOfferId)) {
      setSelectedOfferId(initialOfferId);
      return;
    }
    if (selectedOfferId && hostSelectableOffers.some((o) => o.id === selectedOfferId)) return;
    setSelectedOfferId(hostSelectableOffers[hostSelectableOffers.length - 1]?.id ?? null);
  }, [isCreator, hostSelectableOffers, selectedOfferId, initialOfferId]);

  const focusOffer = isCreator
    ? hostSelectableOffers.find((o) => o.id === selectedOfferId) ??
      (initialOfferId ? hostSelectableOffers.find((o) => o.id === initialOfferId) : null) ??
      hostSelectableOffers[hostSelectableOffers.length - 1] ??
      null
    : (initialOfferId
        ? guestLiveOffers.find((o) => o.id === initialOfferId)
        : null) ??
      guestLiveOffers[guestLiveOffers.length - 1] ??
      null;

  useEffect(() => {
    if (!planId || !isSupabaseConfigured) return;
    return subscribePlanOffersRealtime({
      planId,
      onRefresh: () => {
        void loadRef.current();
        bumpNegotiationRefresh();
      },
      onOffersChange: (payload) => applyOfferRealtimeRef.current(payload),
      onPlanChange: () => {
        onPlanRefresh?.();
      },
    });
  }, [planId, bumpNegotiationRefresh, onPlanRefresh]);

  useEffect(() => {
    if (!planId || !isSupabaseConfigured) return;
    return attachPlanNegotiationRoundsChannels({
      planId,
      offerId: focusOffer?.id ?? initialOfferId ?? null,
      onRefresh: bumpNegotiationRefresh,
    });
  }, [planId, focusOffer?.id, initialOfferId, bumpNegotiationRefresh]);

  const counterOpenedRef = useRef(false);
  useEffect(() => {
    if (counterOpenedRef.current || !openCounterOnMount || !focusOffer || !user) return;
    const ctx = deriveNegotiationContext(focusOffer, plan, user.id);
    if (ctx.isLive && ctx.isMyTurn) {
      counterOpenedRef.current = true;
      setCounterOffer(focusOffer);
    }
  }, [openCounterOnMount, focusOffer, plan, user]);

  const showActionBar = Boolean(focusOffer && canNegotiate && !moodClosed);

  const guestAcceptedOffer =
    !isCreator && user?.id
      ? sorted.find((o) => o.bidder_id === user.id && o.status === 'accepted')
      : null;

  const hostAcceptedOffer =
    isCreator
      ? [...sorted]
          .filter((o) => o.status === 'accepted' && o.bidder_id !== plan.creator_id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
      : null;

  const acceptedOfferPanel = guestAcceptedOffer ?? hostAcceptedOffer;

  const sparkTonight = tonightAt(19, 0);
  const sparkTomorrowNoon = tomorrowAt(12, 0);
  const sparkSaturdayBrunch = nextSaturdayAt(11, 0);

  const clearQuickSparkSelection = useCallback(() => {
    setActiveQuickSpark(null);
  }, []);

  const applyManualProposedAt = useCallback(
    (date: Date | null) => {
      setProposedAt(date);
      clearQuickSparkSelection();
    },
    [clearQuickSparkSelection]
  );

  const applyManualNote = useCallback(
    (text: string) => {
      setNote(text);
      clearQuickSparkSelection();
    },
    [clearQuickSparkSelection]
  );

  const toggleQuickSpark = useCallback(
    (id: QuickSparkId) => {
      if (activeQuickSpark === id) {
        setActiveQuickSpark(null);
        setNote('');
        if (isTimeQuickSpark(id)) {
          setProposedAt(null);
        }
        return;
      }

      setActiveQuickSpark(id);
      setNote(QUICK_SPARK_NOTES[id]);
      switch (id) {
        case 'tonight':
          setProposedAt(sparkTonight);
          break;
        case 'tomorrow':
          setProposedAt(sparkTomorrowNoon);
          break;
        case 'sat_brunch':
          setProposedAt(sparkSaturdayBrunch);
          break;
        case 'public':
        case 'your_pick':
        case 'low_key':
          setProposedAt(null);
          break;
        default:
          break;
      }
    },
    [activeQuickSpark, sparkSaturdayBrunch, sparkTonight, sparkTomorrowNoon]
  );

  function openMeetTimePicker() {
    const base = proposedAt ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (e, date) => {
          if (e.type === 'dismissed' || !date) return;
          const merged = new Date(date);
          merged.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
          setTimeout(() => {
            DateTimePickerAndroid.open({
              value: merged,
              mode: 'time',
              is24Hour: false,
              onChange: (ev, timeDate) => {
                if (ev.type === 'dismissed' || !timeDate) return;
                applyManualProposedAt(timeDate);
              },
            });
          }, 0);
        },
      });
      return;
    }
    setShowTime(true);
  }

  async function openDm() {
    if (!user) return;
    if (!plan.is_group_plan) {
      const lastBidder = [...sorted].reverse().find((o) => o.bidder_id !== plan.creator_id)?.bidder_id;
      const other = isCreator ? lastBidder ?? null : plan.creator_id;
      if (!other) {
        showFeedback(
          'warning',
          'Chat',
          isCreator ? 'No one’s raised their hand yet. Check back soon.' : 'Could not open chat.'
        );
        return;
      }
    }
    const gate = await checkOfferBeforeChatOnPlan(user.id, planId, isCreator);
    if (!gate.allowed) {
      setDmGateOpen(true);
      return;
    }
    try {
      await openPlanMeetupChat({ plan, userId: user.id, isCreator, offers: sorted });
    } catch (e) {
      const message =
        e instanceof PlanMeetupChatError || e instanceof Error ? e.message : 'Could not open chat.';
      showFeedback('warning', 'Chat', message);
    }
  }

  async function sendOffer() {
    if (!user || !isSupabaseConfigured || !canNegotiate) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    const myWaiting = guestLiveOffers.find(
      (o) => o.awaiting_response_from === 'host' && o.status !== 'countered_by_host'
    );
    const counterTarget = guestLiveOffers.find((o) => o.status === 'countered_by_host') ?? null;
    if (myWaiting && !counterTarget) {
      showFeedback('warning', 'Offer pending', 'Wait for the host to respond or withdraw your offer.');
      return;
    }
    if (plan.is_group_plan) {
      const active = bidderHasActiveGroupSlotOffer(offers, user.id);
      if (active?.status === 'accepted') {
        showFeedback('warning', 'Already in the group', 'You already have an accepted slot on this plan.');
        return;
      }
      if (active && !counterTarget) {
        showFeedback('warning', 'Offer pending', 'You already have an active slot request on this plan.');
        return;
      }
      if (countOffersTowardLimitForBidder(offers, user.id) >= MAX_OFFERS_PER_PLAN && !counterTarget) {
        showFeedback(
          'warning',
          'Let’s pause here',
          `You’ve reached the friendly back-and-forth limit for your slot (${MAX_OFFERS_PER_PLAN} rounds). Chat in messages to align, then try again if you open a new idea.`
        );
        return;
      }
    } else if (countOffersTowardLimit(offers) >= MAX_OFFERS_PER_PLAN && !counterTarget) {
      showFeedback(
        'warning',
        'Let’s pause here',
        `You’ve reached the friendly back-and-forth limit for this meetup (${MAX_OFFERS_PER_PLAN} rounds). Chat in messages to align, then try again if you open a new idea.`
      );
      return;
    }
    const cents = amount.trim() ? Math.round(Number(amount) * 100) : null;
    if (cents != null && (Number.isNaN(cents) || cents < 0)) {
      showFeedback(
        'warning',
        'Hmm',
        'Enter a valid amount or leave it blank. Totally fine to figure out money later.'
      );
      return;
    }
    setSending(true);
    const noteBody = note.trim() || null;
    const noteWithSuggested =
      groupSplitPlan && suggestedShareCents && !counterTarget
        ? noteBody
          ? `Suggested: ${formatGroupSplitCents(suggestedShareCents, plan.currency)} | ${noteBody}`
          : `Suggested: ${formatGroupSplitCents(suggestedShareCents, plan.currency)}`
        : noteBody;
    const res = await submitOfferOrCounter(supabase, {
      planId,
      amountCents: cents,
      note: noteWithSuggested,
      proposedScheduledAt: proposedAt ? proposedAt.toISOString() : null,
      offerId: counterTarget?.id ?? null,
    });
    setSending(false);
    if (res.error) showFeedback('error', 'Error', res.error);
    else {
      setAmount('');
      setNote('');
      setActiveQuickSpark(null);
      setProposedAt(plan.scheduled_at ? new Date(plan.scheduled_at) : null);
      setShowTime(false);
      Keyboard.dismiss();
      closeSuggestionSheet();
      void load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }

  async function runConfirmAction() {
    if (!confirm || !user || !isSupabaseConfigured) return;
    const { kind, offer } = confirm;
    const ctx = deriveNegotiationContext(offer, plan, user.id);
    setActionBusy(true);
    let error: string | null = null;

    if (kind === 'accept') {
      const res = ctx.isHost
        ? await hostRespondToOffer(supabase, { offerId: offer.id, action: 'accept' })
        : await guestRespondToCounter(supabase, { offerId: offer.id, action: 'accept' });
      error = res.error;
      if (!error) {
        const href = plan.is_group_plan
          ? resolvePlanAgreementHref(plan, { offerId: offer.id })
          : resolvePlanAgreementHref(plan);
        router.replace(href);
      }
    } else if (kind === 'decline') {
      const res = ctx.isHost
        ? await hostRespondToOffer(supabase, { offerId: offer.id, action: 'decline' })
        : await guestRespondToCounter(supabase, { offerId: offer.id, action: 'decline' });
      error = res.error;
      if (!error) void load();
    } else if (kind === 'withdraw') {
      const res = await withdrawOffer(supabase, offer.id);
      error = res.error;
      if (!error) void load();
    }

    setActionBusy(false);
    setConfirm(null);
    if (error) showFeedback('error', 'Error', error);
  }

  async function handleCounterSubmit(
    amountCents: number | null,
    counterNote: string,
    proposedScheduledAt: string | null
  ) {
    if (!counterOffer || !user || !isSupabaseConfigured) return;
    const ctx = deriveNegotiationContext(counterOffer, plan, user.id);
    setActionBusy(true);
    const res = ctx.isHost
      ? await hostRespondToOffer(supabase, {
          offerId: counterOffer.id,
          action: 'counter',
          counterAmountCents: amountCents,
          note: counterNote || null,
          proposedScheduledAt,
        })
      : await guestRespondToCounter(supabase, {
          offerId: counterOffer.id,
          action: 'counter',
          counterAmountCents: amountCents,
          note: counterNote || null,
          proposedScheduledAt,
        });
    setActionBusy(false);
    setCounterOffer(null);
    if (res.error) showFeedback('error', 'Error', res.error);
    else void load();
  }

  /** Offset for stacked chrome above this screen (plan title bar + safe area). */
  const kbOffset = insets.top + 52;

  const [chatAreaHeight, setChatAreaHeight] = useState(0);
  const [topBlockHeight, setTopBlockHeight] = useState(0);
  const planTheMeetupGap = 18;

  const expandedHeight = useMemo(() => {
    if (chatAreaHeight <= 0 || topBlockHeight <= 0) return 400;
    const raw = chatAreaHeight - topBlockHeight - planTheMeetupGap;
    return Math.floor(Math.max(280, Math.min(raw, chatAreaHeight * 0.91)));
  }, [chatAreaHeight, topBlockHeight]);

  const collapsedHeight = useMemo(() => {
    const ideal = 312;
    const maxCollapsed = Math.max(230, expandedHeight - 96);
    return Math.min(ideal, maxCollapsed);
  }, [expandedHeight]);

  const midHeight = collapsedHeight;

  const sheet = useDraggableSheet({ expandedHeight, collapsedHeight, midHeight });
  collapseSheetRef.current = sheet.collapse;

  const openSuggestionSheet = useCallback(() => {
    setSuggestionSheetVisible(true);
    requestAnimationFrame(() => sheet.expand());
  }, [sheet]);

  const closeSuggestionSheet = useCallback(() => {
    sheet.collapse();
    setTimeout(() => setSuggestionSheetVisible(false), 280);
  }, [sheet]);

  useEffect(() => {
    if (suggestionSheetVisible) {
      sheet.expand();
    }
  }, [suggestionSheetVisible, sheet]);

  const suggestionSheetOpen = !!(canNegotiate && user && !isCreator && suggestionSheetVisible);
  useKeyboardStickyFooterMode(suggestionSheetOpen || counterOffer != null);

  const listPaddingBottom = useMemo(() => {
    if (suggestionSheetOpen) {
      return expandedHeight + Math.max(insets.bottom, spacing.md) + spacing.md;
    }
    return Math.max(insets.bottom, spacing.md) + spacing.lg;
  }, [expandedHeight, insets.bottom, suggestionSheetOpen]);

  const composer =
    suggestionSheetOpen ? (
      <DropIdeaSheet
        controller={sheet}
        keyboardVerticalOffset={kbOffset}
        typingBackdropStyle={typingBackdropStyle}
        composerLiftStyle={composerLiftStyle}
      >
        <ControllerAwareScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          bounces
          bottomOffset={20}
          extraKeyboardSpace={16}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingHorizontal: spacing.lg,
          }}
        >
            <Text style={styles.composerSubtitle}>
              Time, vibe, where: the good stuff. Money’s optional; chemistry isn’t. Keep it light, you’ll polish it
              together.
            </Text>
            <Text style={styles.chipsSectionLabel}>Quick sparks</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              <GradientSelectionChip
                compact
                label="Tonight · 7pm"
                selected={activeQuickSpark === 'tonight'}
                onPress={() => toggleQuickSpark('tonight')}
              />
              <GradientSelectionChip
                compact
                label="Tomorrow · noon"
                selected={activeQuickSpark === 'tomorrow'}
                onPress={() => toggleQuickSpark('tomorrow')}
              />
              <GradientSelectionChip
                compact
                label="Sat · brunch"
                selected={activeQuickSpark === 'sat_brunch'}
                onPress={() => toggleQuickSpark('sat_brunch')}
              />
              <GradientSelectionChip
                compact
                label="Public spot"
                selected={activeQuickSpark === 'public'}
                onPress={() => toggleQuickSpark('public')}
              />
              <GradientSelectionChip
                compact
                label="Your pick"
                selected={activeQuickSpark === 'your_pick'}
                onPress={() => toggleQuickSpark('your_pick')}
              />
              <GradientSelectionChip
                compact
                label="Low-key"
                selected={activeQuickSpark === 'low_key'}
                onPress={() => toggleQuickSpark('low_key')}
              />
            </ScrollView>
            {groupSplitPlan && suggestedShareCents != null && suggestedShareCents > 0 ? (
              <View style={styles.suggestedShareAnchor}>
                <Text style={styles.chipsSectionLabel}>Suggested share</Text>
                <Text style={styles.suggestedShareAmount}>
                  {formatGroupSplitCents(grossAmountCents(suggestedShareCents), plan.currency)}
                </Text>
                <Text style={styles.composerSubtitle}>
                  {`Based on ${remainingGuestSlots} remaining slot${remainingGuestSlots === 1 ? '' : 's'} and the plan total of ${formatGroupSplitCents(plan.starting_price_cents, plan.currency)}`}
                </Text>
                <View style={styles.suggestedShareBreakdown}>
                  <View style={styles.suggestedShareBudgetRow}>
                    <Text style={styles.suggestedShareBudgetLabel}>Plan contribution</Text>
                    <Text style={styles.suggestedShareBudgetValue}>
                      {formatGroupSplitCents(suggestedShareCents, plan.currency)}
                    </Text>
                  </View>
                  <OfferFeeBreakdown
                    budgetCents={suggestedShareCents}
                    currency={plan.currency}
                    showDivider
                  />
                </View>
                <View style={styles.formDivider} />
              </View>
            ) : null}
            <Input
              label="If it’s paid (optional)"
              variant="onboardingFlat"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="Skip for now"
            />
            {offerBudgetCents > 0 ? (
              <View style={styles.inputFeeBreakdown}>
                <OfferFeeBreakdown
                  budgetCents={offerBudgetCents}
                  currency={plan.currency}
                  showDivider
                />
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>When</Text>
            <Pressable onPress={openMeetTimePicker} style={planCreateTouchableFieldStyle(styles.timeBtnRow)}>
              <View style={styles.timeRowLeft}>
                <LinearGradient
                  colors={['rgba(94, 82, 255, 0.18)', 'rgba(255, 74, 114, 0.14)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.timeIconBubble}
                >
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                </LinearGradient>
                <Text style={styles.timeBtnTxt}>
                  {proposedAt
                    ? proposedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Same as the meetup idea'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            {Platform.OS === 'ios' && showTime ? (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={proposedAt ?? new Date()}
                  mode="datetime"
                  display="spinner"
                  onChange={(_, d) => {
                    if (d) applyManualProposedAt(d);
                  }}
                />
                <Button title="Done" variant="ghost" onPress={() => setShowTime(false)} />
              </View>
            ) : null}
            <Input
              label="Add a note"
              variant="onboardingFlat"
              value={note}
              onChangeText={applyManualNote}
              placeholder="What sounds fun?"
            />
            <View style={styles.sheetButtonRow}>
              <Pressable
                accessibilityRole="button"
                disabled={sending}
                onPress={() => void sendOffer()}
                style={({ pressed }) => [
                  styles.sheetBtnOuter,
                  styles.sheetBtnPrimaryShadow,
                  pressed && styles.hostCtaPressed,
                ]}
              >
                <LinearGradient
                  colors={[...APP_CTA_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sheetBtnPrimary}
                >
                  {sending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sheetBtnPrimaryTxt}>Suggest</Text>
                  )}
                </LinearGradient>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={closeSuggestionSheet}
                style={({ pressed }) => [styles.sheetBtnOuter, pressed && styles.hostCtaPressed]}
              >
                <LinearGradient
                  colors={[...APP_CTA_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sheetBtnSecondaryBorder}
                >
                  <View style={styles.sheetBtnSecondaryInner}>
                    <Text style={styles.sheetBtnSecondaryTxt}>Close</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
        </ControllerAwareScrollView>
      </DropIdeaSheet>
    ) : null;

  const listFooter = (
    <>
      {isCreator && groupSplitPlan ? (
        <GroupSplitHostFooter
          plan={plan}
          onPlanUpdated={() => {
            void load();
            onPlanRefresh?.();
          }}
        />
      ) : null}
      {showActionBar && focusOffer ? (
      <View
        style={[
          negotiationPanelStyles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <NegotiationOfferActions
          offer={focusOffer}
          plan={plan}
          currentUserId={user?.id}
          busy={actionBusy}
          refreshToken={negotiationRefreshToken}
          onAccept={() => {
            if (requiresVerificationGate(dbUser?.verification_status)) {
              setGateOpen(true);
              return;
            }
            if (isOfferExpired(focusOffer)) {
              showFeedback('warning', 'Expired', 'This suggestion timed out. Send a fresh one when you’re ready.');
              return;
            }
            setConfirm({ kind: 'accept', offer: focusOffer });
          }}
          onCounter={() => setCounterOffer(focusOffer)}
          onDecline={() => setConfirm({ kind: 'decline', offer: focusOffer })}
          onWithdraw={() => setConfirm({ kind: 'withdraw', offer: focusOffer })}
        />
      </View>
      ) : null}
      {!showActionBar && acceptedOfferPanel ? (
        <View
          style={[
            negotiationPanelStyles.footer,
            { paddingBottom: Math.max(insets.bottom, spacing.sm) },
          ]}
        >
          <NegotiationOfferActions
            offer={acceptedOfferPanel}
            plan={plan}
            currentUserId={user?.id}
            busy={actionBusy}
            refreshToken={negotiationRefreshToken}
            onAccept={() => {}}
            onCounter={() => {}}
            onDecline={() => {}}
            onWithdraw={() => {}}
          />
        </View>
      ) : null}
    </>
  );

  if (!offersLoading && flowAdvance.redirect) {
    return (
      <View style={[styles.flex, styles.redirectingWrap]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex} onLayout={(e) => setChatAreaHeight(e.nativeEvent.layout.height)}>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
      />
      <AppConfirmModal
        visible={dmGateOpen}
        onClose={() => setDmGateOpen(false)}
        kicker="Messaging"
        title="Make an offer first"
        message={
          isCreator
            ? 'Wait for someone to send an offer on this meetup before opening chat. Offers keep plans intentional.'
            : 'Share an offer on this meetup before opening chat. Use the form below to suggest a time, note, or amount.'
        }
        primaryLabel={isCreator ? 'Got it' : 'Make an offer'}
        onPrimary={() => {
          setDmGateOpen(false);
          if (!isCreator) {
            openSuggestionSheet();
          }
        }}
        secondaryLabel="Not now"
        iconVariant="warning"
      />
      <AppConfirmModal
        visible={confirm != null}
        onClose={() => !actionBusy && setConfirm(null)}
        kicker="Offers"
        title={
          confirm?.kind === 'accept'
            ? 'Accept offer?'
            : confirm?.kind === 'decline'
              ? 'Decline offer?'
              : 'Withdraw offer?'
        }
        message={
          confirm?.kind === 'accept'
            ? 'You’ll move on to the agreement and payment steps next.'
            : confirm?.kind === 'decline'
              ? 'This will end the negotiation. The other party will be notified.'
              : 'Take back your offer. You can submit a new one if you change your mind.'
        }
        primaryLabel={
          confirm?.kind === 'accept' ? 'Accept' : confirm?.kind === 'decline' ? 'Decline' : 'Withdraw'
        }
        onPrimary={() => void runConfirmAction()}
        secondaryLabel="Cancel"
        onSecondary={() => setConfirm(null)}
        secondaryTone={confirm?.kind === 'accept' ? 'neutral' : 'danger'}
        iconVariant={confirm?.kind === 'accept' ? 'default' : 'warning'}
        busyOn="primary"
      />
      <OfferCounterSheet
        visible={counterOffer != null}
        offer={counterOffer}
        currency={plan.currency}
        loading={actionBusy}
        onClose={() => setCounterOffer(null)}
        onSubmit={(cents, n, at) => void handleCounterSubmit(cents, n, at)}
      />
      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'error'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
      />
      <View style={styles.topBar} onLayout={(e) => setTopBlockHeight(e.nativeEvent.layout.height)}>
        {moodClosed ? (
          <View style={styles.expiredStrip}>
            <Ionicons name="moon-outline" size={18} color="#64748b" />
            <Text style={styles.expiredStripTxt}>
              This mood window closed. You can read what was shared, but new offers stay paused.
            </Text>
          </View>
        ) : null}
        <View style={styles.hintCard}>
          <View style={styles.hintCardHeader}>
            <LinearGradient
              colors={[colors.primary, '#8B84FF', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hintIconGradient}
            >
              <Ionicons name="heart" size={20} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.hintTitleBlock}>
              <Text style={styles.hintTitle}>Plan the meetup</Text>
              <Text style={styles.hintKicker}>Make it real</Text>
            </View>
          </View>
          <Text style={styles.hint}>
            Ideas expire in 24 hours, with up to {MAX_OFFERS_PER_PLAN} gentle rounds here. Send an offer first, then chat
            opens for the practical stuff.
          </Text>
          <View style={styles.cardButtonRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void openDm()}
              style={({ pressed }) => [
                styles.sheetBtnOuter,
                styles.sheetBtnPrimaryShadow,
                pressed && styles.hostCtaPressed,
              ]}
            >
              <LinearGradient
                colors={[...APP_CTA_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.sheetBtnPrimary, styles.cardBtnContent]}
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#FFFFFF" />
                <Text style={styles.sheetBtnPrimaryTxt}>Open chat</Text>
              </LinearGradient>
            </Pressable>
            {canNegotiate && !isCreator ? (
              <Pressable
                accessibilityRole="button"
                onPress={openSuggestionSheet}
                style={({ pressed }) => [styles.sheetBtnOuter, pressed && styles.hostCtaPressed]}
              >
                <LinearGradient
                  colors={[...APP_CTA_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sheetBtnSecondaryBorder}
                >
                  <View style={[styles.sheetBtnSecondaryInner, styles.cardBtnContent]}>
                    <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                    <Text style={styles.sheetBtnSecondaryTxt}>Suggestion</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      <Animated.View
        style={[styles.listFlex, sheet.backdropAnimatedStyle] as unknown as StyleProp<ViewStyle>}
      >
      <FlatList
        ref={listRef}
        style={styles.listFill}
        data={sorted}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.list,
          !offersLoading && sorted.length === 0 ? styles.listEmpty : null,
          { paddingBottom: listPaddingBottom },
        ]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          offersLoading ? null : (
            <View style={styles.emptyWrap}>
              <LinearGradient
                colors={['rgba(94, 82, 255, 0.2)', 'rgba(255, 74, 114, 0.18)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconRing}
              >
                <View style={styles.emptyIconInner}>
                  <Ionicons name="sparkles" size={30} color={colors.primary} />
                </View>
              </LinearGradient>
              <Text style={styles.emptyTitle}>{isCreator ? 'Still quiet here' : 'Start a spark'}</Text>
              <Text style={styles.empty}>
                {isCreator
                  ? 'When someone sends a time or a vibe, it lands here. Until then, keep the chat warm. Chemistry over logistics.'
                  : 'Lead with something easy: a time, a place, a feeling. You can always fine-tune what happens next.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={listFooter}
        renderItem={({ item }) => {
          const mine = item.bidder_id === user?.id;
          const hostSent = item.bidder_id === plan.creator_id;
          const liveActionable =
            isCreator && isOfferLive(item) && item.bidder_id !== plan.creator_id && !moodClosed;
          return (
            <OfferBubble
              offer={item}
              currency={plan.currency}
              isMine={mine}
              isHost={hostSent}
              showHostLabel
              selected={liveActionable && item.id === focusOffer?.id}
              onPress={
                liveActionable ? () => setSelectedOfferId(item.id) : undefined
              }
            />
          );
        }}
      />
      </Animated.View>
      {suggestionSheetVisible ? (
        <Pressable style={styles.sheetOverlay} onPress={closeSuggestionSheet} accessibilityLabel="Close suggestion sheet" />
      ) : null}
      {composer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  redirectingWrap: { justifyContent: 'center', alignItems: 'center' },
  /** Matches meetup details `scrollContent` horizontal inset. */
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  expiredStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(100,116,139,0.12)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  expiredStripTxt: { flex: 1, fontSize: 13, fontWeight: '600',
    fontFamily: fonts.medium, color: colors.text, lineHeight: 18 },
  hintCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#4C1D95',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.09,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  hintCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  hintIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitleBlock: { flex: 1, minWidth: 0 },
  hintKicker: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  hintTitle: { fontSize: 19, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.5, lineHeight: 24 },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
    letterSpacing: -0.15,
  },
  cardButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    zIndex: 15,
  },
  sheetButtonRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetBtnOuter: {
    flex: 1,
    minWidth: 0,
    height: 50,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  sheetBtnPrimaryShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  sheetBtnPrimary: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sheetBtnPrimaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  sheetBtnSecondaryBorder: {
    height: 50,
    borderRadius: radius.button,
    padding: 1.5,
  },
  sheetBtnSecondaryInner: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.button - 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sheetBtnSecondaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  listFlex: { flex: 1, minHeight: 0 },
  listFill: { flex: 1 },
  list: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  emptyWrap: { alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyIconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyIconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 23,
    maxWidth: 300,
    letterSpacing: -0.2,
  },
  hostActionSheet: {
    width: '100%',
    alignSelf: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.12)',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  hostActionRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  hostPrimaryOuter: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  hostPrimaryGrad: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  hostPrimaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  hostSecondaryOuter: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  hostSecondaryGradBorder: {
    borderRadius: radius.button,
    padding: 1.5,
  },
  hostSecondaryInner: {
    minHeight: 47,
    backgroundColor: colors.surface,
    borderRadius: radius.button - 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  hostSecondaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  hostCtaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  composerSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.sm,
    letterSpacing: -0.15,
  },
  chipsSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    letterSpacing: 1.4,
  },
  suggestedShareAnchor: {
    marginBottom: spacing.sm,
  },
  suggestedShareAmount: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: -0.4,
    marginBottom: spacing.xs,
  },
  suggestedShareBreakdown: {
    marginTop: spacing.xs,
    gap: 6,
  },
  suggestedShareBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestedShareBudgetLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  suggestedShareBudgetValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  inputFeeBreakdown: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  formDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipScroll: {
    height: GRADIENT_CHIP_HEIGHT,
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    height: GRADIENT_CHIP_HEIGHT,
    paddingRight: spacing.sm,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  timeBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: 54,
  },
  timeRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  timeIconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBtnTxt: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    flex: 1,
    letterSpacing: -0.2,
    minWidth: 0,
  },
  sendCta: {
    marginTop: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  iosPickerWrap: { marginBottom: spacing.sm },
});
