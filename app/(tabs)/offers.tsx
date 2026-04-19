/**
 * Offers — sent & received negotiation rows with realtime updates.
 */
import { Button } from '@/components/Button';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { OfferListCard } from '@/components/offers/OfferListCard';
import { OffersSegmentedControl, type OffersSegment } from '@/components/offers/OffersSegmentedControl';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { acceptPlanOffer } from '@/lib/plans/acceptPlanOffer';
import {
  fetchReceivedOffers,
  fetchSentOffers,
  type OfferDashboardRow,
} from '@/lib/plans/fetchOffersDashboard';
import { isOfferExpired } from '@/lib/plans/offerRules';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requiresVerificationGate } from '@/lib/verification/access';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function OffersSkeleton() {
  return (
    <View style={styles.skelWrap}>
      {[0, 1].map((k) => (
        <View key={k} style={styles.skelCard}>
          <View style={styles.skelBadge} />
          <View style={styles.skelLineLg} />
          <View style={styles.skelRow}>
            <View style={styles.skelAvatar} />
            <View style={styles.skelCol}>
              <View style={styles.skelLineMd} />
              <View style={styles.skelLineSm} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function OffersScreen() {
  const { user, dbUser } = useAuth();
  const [segment, setSegment] = useState<OffersSegment>('sent');
  const [sent, setSent] = useState<OfferDashboardRow[]>([]);
  const [received, setReceived] = useState<OfferDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const loadBothRef = useRef<() => Promise<void>>(async () => {});

  const loadBoth = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setSent([]);
      setReceived([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, r] = await Promise.all([fetchSentOffers(user.id), fetchReceivedOffers(user.id)]);
      setSent(s);
      setReceived(r);
    } catch {
      setSent([]);
      setReceived([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  loadBothRef.current = loadBoth;

  useFocusEffect(
    useCallback(() => {
      void loadBothRef.current();
      if (!user?.id || !isSupabaseConfigured) return () => {};
      let debounce: ReturnType<typeof setTimeout> | undefined;
      const ch = supabase
        .channel(`offers-dash-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'plan_offers' },
          () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => void loadBothRef.current(), 180);
          }
        )
        .subscribe();
      return () => {
        if (debounce) clearTimeout(debounce);
        void supabase.removeChannel(ch);
      };
    }, [user?.id])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBothRef.current();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const list = segment === 'sent' ? sent : received;

  async function handleAccept(row: OfferDashboardRow) {
    if (!user) return;
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    if (isOfferExpired(row.offer)) {
      Alert.alert('Expired', 'This offer is no longer active.');
      return;
    }
    setBusyOfferId(row.offer.id);
    const res = await acceptPlanOffer(supabase, {
      planId: row.plan.id,
      offer: row.offer,
      plan: row.plan,
      currentUserId: user.id,
    });
    setBusyOfferId(null);
    if (res.error) Alert.alert('Could not accept', res.error);
    else router.replace(`/plan/${row.plan.id}/agreement` as Href);
  }

  async function handleReject(row: OfferDashboardRow) {
    Alert.alert('Decline offer?', 'The guest will see this offer as declined.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setBusyOfferId(row.offer.id);
          const { error } = await supabase.from('plan_offers').update({ status: 'declined' }).eq('id', row.offer.id);
          setBusyOfferId(null);
          if (error) Alert.alert('Error', error.message);
          else void loadBothRef.current();
        },
      },
    ]);
  }

  function openNegotiate(planId: string) {
    router.push(`/plan/${planId}/negotiate` as Href);
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
        title="Verification required"
        message="Accepting offers requires a verified identity on LinkUp."
      />
      <View style={styles.header}>
        <Text style={styles.title}>Offers</Text>
        <Text style={styles.sub}>Track what you’ve sent and what hosts send back</Text>
      </View>
      <OffersSegmentedControl
        value={segment}
        onChange={setSegment}
        sentCount={sent.length}
        receivedCount={received.length}
      />
      <FlatList
        data={loading ? [] : list}
        keyExtractor={(r) => r.offer.id}
        extraData={busyOfferId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <OffersSkeleton />
          ) : segment === 'sent' ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>You haven’t sent any offers yet</Text>
              <Text style={styles.emptySub}>When you negotiate on a plan, your offers show up here</Text>
              <Button title="Browse plans" onPress={() => router.push('/' as Href)} style={styles.emptyCta} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No offers yet</Text>
              <Text style={styles.emptySub}>
                When someone is interested in your plan, their offer will show here
              </Text>
              <Button title="View my plans" onPress={() => router.push('/' as Href)} style={styles.emptyCta} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <OfferListCard
            row={item}
            mode={segment}
            busy={busyOfferId === item.offer.id}
            onPressOpen={() => openNegotiate(item.plan.id)}
            onAccept={segment === 'received' ? () => void handleAccept(item) : undefined}
            onReject={segment === 'received' ? () => void handleReject(item) : undefined}
            onNegotiate={segment === 'received' ? () => openNegotiate(item.plan.id) : undefined}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20, fontWeight: '500' },
  list: { paddingBottom: 120, flexGrow: 1 },
  empty: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptySub: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  emptyCta: { marginTop: spacing.lg, minWidth: 200 },
  skelWrap: { paddingTop: spacing.xs },
  skelCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  skelBadge: { width: 72, height: 22, borderRadius: 11, backgroundColor: colors.border, marginBottom: spacing.sm },
  skelLineLg: { height: 18, borderRadius: 6, backgroundColor: colors.border, width: '88%', marginBottom: spacing.md },
  skelRow: { flexDirection: 'row', gap: spacing.sm },
  skelAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border },
  skelCol: { flex: 1, gap: 8, justifyContent: 'center' },
  skelLineMd: { height: 14, borderRadius: 6, backgroundColor: colors.border, width: '70%' },
  skelLineSm: { height: 12, borderRadius: 6, backgroundColor: colors.border, width: '45%' },
});
