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
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlan, DbPlanOffer } from '@/types/database';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { OfferBubble } from '@/components/plans/negotiation/OfferBubble';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  plan: DbPlan;
};

export function NegotiationChat({ plan }: Props) {
  const { user, dbUser } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [offers, setOffers] = useState<DbPlanOffer[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proposedAt, setProposedAt] = useState<Date | null>(plan.scheduled_at ? new Date(plan.scheduled_at) : null);
  /** iOS only — Android uses imperative DateTimePickerAndroid (datetime JSX breaks dismiss on unmount). */
  const [showTime, setShowTime] = useState(false);
  const [sending, setSending] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const planId = plan.id;
  const isCreator = user?.id === plan.creator_id;
  const canNegotiate = plan.status === 'negotiating';

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
      Alert.alert('Messages', isCreator ? 'No bidder yet.' : 'Could not open chat.');
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
      Alert.alert('Offer limit', `You can send up to ${MAX_OFFERS_PER_PLAN} active offer rounds on this plan.`);
      return;
    }
    const cents = amount.trim() ? Math.round(Number(amount) * 100) : null;
    if (cents != null && (Number.isNaN(cents) || cents < 0)) {
      Alert.alert('Invalid amount', 'Enter a valid price or leave blank for open offers.');
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
    if (error) Alert.alert('Error', error.message);
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
    if (error) Alert.alert('Error', error.message);
    else void load();
  }

  async function acceptOfferRow(offer: DbPlanOffer) {
    if (!user || !isCreator || !isSupabaseConfigured) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (isOfferExpired(offer)) {
      Alert.alert('Expired', 'This offer has expired.');
      return;
    }
    const res = await acceptPlanOffer(supabase, {
      planId,
      offer,
      plan,
      currentUserId: user.id,
    });
    if (res.error) Alert.alert('Error', res.error);
    else router.replace(`/plan/${planId}/agreement` as Href);
  }

  /** Offset for stacked chrome above this screen (plan title bar + safe area). */
  const kbOffset = insets.top + 52;

  const composer =
    canNegotiate && user && !isCreator ? (
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={kbOffset}
        style={styles.composerKb}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.md) }}
        >
          <View style={styles.composer}>
            <Text style={styles.composerTitle}>Make an offer</Text>
            <Text style={styles.composerSubtitle}>Optional price and time — add a note for context.</Text>
            <Input
              label="Price (optional)"
              variant="onboardingFlat"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="Leave blank for open"
            />
            <Text style={styles.fieldLabel}>Meet time</Text>
            <Pressable onPress={openMeetTimePicker} style={planCreateTouchableFieldStyle(styles.timeBtnRow)}>
              <Text style={styles.timeBtnTxt}>
                {proposedAt
                  ? proposedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                  : 'Same as plan'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
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
              label="Note (optional)"
              variant="onboardingFlat"
              value={note}
              onChangeText={setNote}
              placeholder="Add context"
            />
            <Button title="Send offer" onPress={() => void sendOffer()} loading={sending} pill />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    ) : null;

  return (
    <View style={styles.flex}>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
      />
      <View style={styles.topBar}>
        <View style={styles.hintCard}>
          <View style={styles.hintCardHeader}>
            <View style={styles.hintIconWrap}>
              <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
            </View>
            <Text style={styles.hintTitle}>How negotiation works</Text>
          </View>
          <Text style={styles.hint}>
            Offers stay open 24h. Up to {MAX_OFFERS_PER_PLAN} active rounds. Use messages for casual chat.
          </Text>
          <Button title="Open messages" variant="ghost" pill onPress={() => void openDm()} style={styles.messagesBtn} />
        </View>
      </View>
      <FlatList
        ref={listRef}
        style={styles.listFlex}
        data={sorted}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, sorted.length === 0 && styles.listEmpty]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No offers yet</Text>
            <Text style={styles.empty}>
              {isCreator ? 'When someone sends an offer, it will appear here.' : 'Send the first offer below to start negotiating.'}
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
              {isCreator && item.status === 'pending' && !isOfferExpired(item) ? (
                <View style={styles.actions}>
                  <Button title="Accept" onPress={() => void acceptOfferRow(item)} style={styles.actionBtn} />
                  <Button title="Decline" variant="ghost" onPress={() => void declineOffer(item)} style={styles.actionBtn} />
                </View>
              ) : null}
            </View>
          );
        }}
      />
      {composer}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  hintCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  hintCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  hintIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.authInputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  messagesBtn: { marginTop: 0 },
  listFlex: { flex: 1 },
  list: { paddingVertical: spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.xs },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  emptyWrap: { alignItems: 'center', paddingHorizontal: spacing.lg },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 14, lineHeight: 20, maxWidth: 280 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, marginHorizontal: spacing.md },
  actionBtn: { flex: 1 },
  composer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  composerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  composerSubtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.text, letterSpacing: 0.3, marginBottom: spacing.xs },
  timeBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  timeBtnTxt: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, paddingRight: spacing.sm },
  composerKb: { flexShrink: 0 },
  iosPickerWrap: { marginBottom: spacing.sm },
});
