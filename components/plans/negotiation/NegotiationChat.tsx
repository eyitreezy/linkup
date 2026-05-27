/**
 * PL5 — offer timeline with chat-like layout + composer (price, time, note).
 */
import { Button } from '@/components/Button';
import { Input, planCreateTouchableFieldStyle } from '@/components/Input';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateConversation } from '@/lib/conversations';
import { acceptPlanOffer } from '@/lib/plans/acceptPlanOffer';
import {
  countOffersTowardLimit,
  isOfferExpired,
  MAX_OFFERS_PER_PLAN,
  nextOfferRound,
  OFFER_TTL_MS,
} from '@/lib/plans/offerRules';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import { useKeyboardAnimation } from '@/hooks/useKeyboardAnimation';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { DropIdeaSheet } from '@/components/plans/negotiation/DropIdeaSheet';
import { useDraggableSheet } from '@/hooks/useDraggableSheet';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { OfferBubble } from '@/components/plans/negotiation/OfferBubble';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  plan: DbPlan;
};

function appendNoteLine(current: string, line: string): string {
  const t = current.trim();
  const L = line.trim();
  if (!L) return current;
  if (t.includes(L)) return current;
  return t ? `${t}\n${L}` : L;
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

export function NegotiationChat({ plan }: Props) {
  const { user, dbUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { typingBackdropStyle } = useKeyboardAnimation();
  const listRef = useRef<FlatList>(null);
  const [offers, setOffers] = useState<DbPlanOffer[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proposedAt, setProposedAt] = useState<Date | null>(plan.scheduled_at ? new Date(plan.scheduled_at) : null);
  /** iOS only — Android uses imperative DateTimePickerAndroid (datetime JSX breaks dismiss on unmount). */
  const [showTime, setShowTime] = useState(false);
  const [sending, setSending] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);

  function showFeedback(variant: AppFeedbackVariant, title: string, message: string) {
    setFeedback({ variant, title, message });
  }

  const planId = plan.id;
  const isCreator = user?.id === plan.creator_id;
  const moodClosed = isPlanMoodWindowClosed(plan);
  const canNegotiate = plan.status === 'negotiating' && !moodClosed;

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) return;
    const { data } = await supabase
      .from('plan_offers')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true });
    if (data) setOffers(data as DbPlanOffer[]);
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...offers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
                setProposedAt(timeDate);
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
    const lastBidder = [...sorted].reverse().find((o) => o.bidder_id !== plan.creator_id)?.bidder_id;
    const other = isCreator ? lastBidder ?? null : plan.creator_id;
    if (!other) {
      showFeedback(
        'warning',
        'Chat',
        isCreator ? 'No one’s raised their hand yet — check back soon.' : 'Could not open chat.'
      );
      return;
    }
    const conv = await getOrCreateConversation(supabase, user.id, other);
    router.push(`/chat/${conv}` as Href);
  }

  async function sendOffer() {
    if (!user || !isSupabaseConfigured || !canNegotiate) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (countOffersTowardLimit(offers) >= MAX_OFFERS_PER_PLAN) {
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
        'Enter a valid amount or leave it blank — totally fine to figure out money later.'
      );
      return;
    }
    setSending(true);
    const expires = new Date(Date.now() + OFFER_TTL_MS).toISOString();
    const { error } = await supabase.from('plan_offers').insert({
      plan_id: planId,
      bidder_id: user.id,
      amount_cents: cents,
      message: note.trim() || null,
      status: 'pending',
      round: nextOfferRound(offers),
      expires_at: expires,
      proposed_scheduled_at: proposedAt ? proposedAt.toISOString() : null,
    });
    setSending(false);
    if (error) showFeedback('error', 'Error', error.message);
    else {
      setAmount('');
      setNote('');
      void load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }

  async function declineOffer(offer: DbPlanOffer) {
    if (!isCreator || !isSupabaseConfigured) return;
    const { error } = await supabase.from('plan_offers').update({ status: 'declined' }).eq('id', offer.id);
    if (error) showFeedback('error', 'Error', error.message);
    else void load();
  }

  async function acceptOfferRow(offer: DbPlanOffer) {
    if (!user || !isCreator || !isSupabaseConfigured) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (isOfferExpired(offer)) {
      showFeedback('warning', 'Expired', 'This suggestion timed out — send a fresh one when you’re ready.');
      return;
    }
    const res = await acceptPlanOffer(supabase, {
      planId,
      offer,
      plan,
      currentUserId: user.id,
    });
    if (res.error) showFeedback('error', 'Error', res.error);
    else router.replace(`/plan/${planId}/agreement` as Href);
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

  const midHeight = useMemo(
    () => Math.round(collapsedHeight + (expandedHeight - collapsedHeight) * 0.5),
    [collapsedHeight, expandedHeight]
  );

  const sheet = useDraggableSheet({ expandedHeight, collapsedHeight, midHeight });

  const listPaddingBottom = useMemo(
    () =>
      canNegotiate && user && !isCreator
        ? collapsedHeight + Math.max(insets.bottom, spacing.md) + spacing.md
        : spacing.xl * 1.25,
    [canNegotiate, collapsedHeight, insets.bottom, isCreator, user]
  );

  const composer =
    canNegotiate && user && !isCreator ? (
      <DropIdeaSheet
        controller={sheet}
        expandedHeight={expandedHeight}
        keyboardVerticalOffset={kbOffset}
        typingBackdropStyle={typingBackdropStyle}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          bounces
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingHorizontal: spacing.lg,
          }}
        >
            <Text style={styles.composerSubtitle}>
              Time, vibe, where — the good stuff. Money’s optional; chemistry isn’t. Keep it light, you’ll polish it
              together.
            </Text>
            <Text style={styles.chipsSectionLabel}>Quick sparks</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable
                onPress={() => setProposedAt(tonightAt(19, 0))}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipTxt}>Tonight · 7pm</Text>
              </Pressable>
              <Pressable
                onPress={() => setProposedAt(tomorrowAt(12, 0))}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipTxt}>Tomorrow · noon</Text>
              </Pressable>
              <Pressable
                onPress={() => setProposedAt(nextSaturdayAt(11, 0))}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipTxt}>Sat · brunch</Text>
              </Pressable>
              <Pressable
                onPress={() => setNote((n) => appendNoteLine(n, 'Somewhere public works for me.'))}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipTxt}>Public spot</Text>
              </Pressable>
              <Pressable
                onPress={() => setNote((n) => appendNoteLine(n, 'Happy to try your favorite place nearby.'))}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipTxt}>Your pick</Text>
              </Pressable>
              <Pressable
                onPress={() => setNote((n) => appendNoteLine(n, 'Keep it casual — open to ideas.'))}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipTxt}>Low-key</Text>
              </Pressable>
            </ScrollView>
            <Input
              label="If it’s paid (optional)"
              variant="onboardingFlat"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="Skip for now"
            />
            <Text style={styles.fieldLabel}>When</Text>
            <Pressable onPress={openMeetTimePicker} style={planCreateTouchableFieldStyle(styles.timeBtnRow)}>
              <View style={styles.timeRowLeft}>
                <LinearGradient
                  colors={['rgba(108, 99, 255, 0.18)', 'rgba(255, 101, 132, 0.14)']}
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
                    if (d) setProposedAt(d);
                  }}
                />
                <Button title="Done" variant="ghost" onPress={() => setShowTime(false)} />
              </View>
            ) : null}
            <Input
              label="Add a note"
              variant="onboardingFlat"
              value={note}
              onChangeText={setNote}
              placeholder="What sounds fun?"
            />
            <Button
              title="Send suggestion"
              onPress={() => void sendOffer()}
              loading={sending}
              pill
              fullWidth
              style={styles.sendCta}
            />
        </KeyboardAwareScrollView>
      </DropIdeaSheet>
    ) : null;

  return (
    <View style={styles.flex} onLayout={(e) => setChatAreaHeight(e.nativeEvent.layout.height)}>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
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
              This mood window closed — you can read what was shared, but new offers stay paused.
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
            Ideas expire in 24 hours — up to {MAX_OFFERS_PER_PLAN} gentle rounds here. Say hi in chat anytime; this spot is
            for dates, times, and the practical stuff.
          </Text>
          <Pressable
            onPress={() => void openDm()}
            style={({ pressed }) => [styles.openChatPill, pressed && styles.openChatPillPressed]}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
            <Text style={styles.openChatTxt}>Open chat</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} style={{ opacity: 0.7 }} />
          </Pressable>
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
          sorted.length === 0 && styles.listEmpty,
          { paddingBottom: listPaddingBottom },
        ]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <LinearGradient
              colors={['rgba(108, 99, 255, 0.2)', 'rgba(255, 101, 132, 0.18)']}
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
                ? 'When someone sends a time or a vibe, it lands here. Until then, keep the chat warm — chemistry over logistics.'
                : 'Lead with something easy — a time, a place, a feeling. You can always fine-tune what happens next.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.bidder_id === user?.id;
          const hostSent = item.bidder_id === plan.creator_id;
          return (
            <View>
              <OfferBubble
                offer={item}
                currency={plan.currency}
                isMine={mine}
                isHost={hostSent}
                showHostLabel
              />
              {isCreator && item.status === 'pending' && !isOfferExpired(item) && !moodClosed ? (
                <View style={styles.actions}>
                  <Button
                    title="Sounds good"
                    onPress={() => void acceptOfferRow(item)}
                    style={Object.assign({}, styles.actionBtn, styles.actionBtnAccept)}
                  />
                  <Button
                    title="Not quite"
                    variant="ghost"
                    onPress={() => void declineOffer(item)}
                    style={styles.actionBtn}
                  />
                </View>
              ) : null}
            </View>
          );
        }}
      />
      </Animated.View>
      {composer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
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
  expiredStripTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 18 },
  hintCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
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
    color: colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  hintTitle: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.5, lineHeight: 24 },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
    letterSpacing: -0.15,
  },
  openChatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.35)',
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  openChatPillPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  openChatTxt: { fontSize: 15, fontWeight: '700', color: colors.primary, letterSpacing: -0.2 },
  listFlex: { flex: 1 },
  listFill: { flex: 1 },
  list: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
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
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 300,
    letterSpacing: -0.2,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, marginHorizontal: spacing.md },
  actionBtn: { flex: 1, minHeight: 50 },
  actionBtnAccept: {
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  composerSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.sm,
    letterSpacing: -0.15,
  },
  chipsSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    letterSpacing: 1.4,
  },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: spacing.md, flexWrap: 'nowrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  chipPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
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
    color: colors.text,
    flex: 1,
    letterSpacing: -0.2,
    minWidth: 0,
  },
  sendCta: {
    marginTop: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  iosPickerWrap: { marginBottom: spacing.sm },
});
