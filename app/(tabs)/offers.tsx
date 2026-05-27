/**
 * Offers — sent & received negotiation rows with realtime updates.
 */
import { Button } from '@/components/Button';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { OfferListCard } from '@/components/offers/OfferListCard';
import { OffersSegmentedControl, type OffersSegment } from '@/components/offers/OffersSegmentedControl';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

  const summaryLabel =
    !loading && (sent.length > 0 || received.length > 0)
      ? `${sent.length + received.length} total`
      : null;

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
        title="Verification required"
        message="Accepting offers requires a verified identity on LinkUp."
      />
      <View style={styles.root}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF5F8', '#E8FAF4', colors.discoveryGradientBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <LinearGradient
              colors={[colors.secondary, '#FF8FA8', colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadge}
            >
              <Ionicons name="pricetag" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Negotiations</Text>
              <Text style={styles.heroTitle}>Offers</Text>
              <Text style={styles.heroSub}>Everything you’ve proposed — and what hosts send your way — in one place.</Text>
            </View>
          </View>
          {summaryLabel ? (
            <View style={styles.countPill}>
              <Text style={styles.countPillTxt}>{summaryLabel}</Text>
            </View>
          ) : null}
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
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            loading ? (
              <OffersSkeleton />
            ) : segment === 'sent' ? (
              <View style={styles.empty}>
                <LinearGradient colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.18)']} style={styles.emptyRing}>
                  <LinearGradient colors={['#fff', '#FFF8FC']} style={styles.emptyRingInner}>
                    <Ionicons name="paper-plane-outline" size={38} color={colors.secondary} />
                  </LinearGradient>
                </LinearGradient>
                <Text style={styles.emptyTitle}>
                  No offers <Text style={styles.emptyTitleAccent}>sent</Text> yet
                </Text>
                <Text style={styles.emptySub}>
                  When you negotiate on a plan, your numbers and notes show up here for easy follow-up.
                </Text>
                <LinearGradient
                  colors={[colors.primary, '#8B7CFF', colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCtaShell}
                >
                  <Button
                    title="Browse plans"
                    onPress={() => router.push('/' as Href)}
                    pill
                    variant="primary"
                    style={styles.emptyCtaInner}
                    textStyle={styles.emptyCtaTxt}
                  />
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.empty}>
                <LinearGradient colors={['rgba(255,101,132,0.22)', 'rgba(108,99,255,0.18)']} style={styles.emptyRing}>
                  <LinearGradient colors={['#fff', '#F5F0FF']} style={styles.emptyRingInner}>
                    <Ionicons name="mail-unread-outline" size={38} color={colors.primary} />
                  </LinearGradient>
                </LinearGradient>
                <Text style={styles.emptyTitle}>
                  Inbox <Text style={styles.emptyTitleAccent}>quiet</Text>
                </Text>
                <Text style={styles.emptySub}>
                  When someone wants in on your plan, their offer appears here — accept, counter, or pass with context.
                </Text>
                <LinearGradient
                  colors={[colors.primary, '#8B7CFF', colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCtaShell}
                >
                  <Button
                    title="View Discover"
                    onPress={() => router.push('/' as Href)}
                    pill
                    variant="primary"
                    style={styles.emptyCtaInner}
                    textStyle={styles.emptyCtaTxt}
                  />
                </LinearGradient>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  root: { flex: 1 },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  heroLeft: { flexDirection: 'row', gap: spacing.md, flex: 1, alignItems: 'flex-start' },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroText: { flex: 1 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.7 },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 21,
  },
  countPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 101, 132, 0.25)',
    marginTop: 8,
  },
  countPillTxt: { fontSize: 11, fontWeight: '900', color: colors.secondary },
  listFlex: { flex: 1 },
  list: { paddingBottom: 120, flexGrow: 1 },
  empty: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, alignItems: 'center' },
  emptyRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  emptyTitleAccent: { color: colors.secondary },
  emptySub: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
    fontWeight: '600',
  },
  emptyCtaShell: {
    marginTop: spacing.xl,
    borderRadius: radius.button,
    padding: 2,
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  emptyCtaInner: { backgroundColor: '#fff', width: '100%', margin: 0 },
  emptyCtaTxt: { color: colors.primary, fontWeight: '900' },
  skelWrap: { paddingTop: spacing.xs },
  skelCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  skelBadge: {
    width: 72,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 101, 132, 0.15)',
    marginBottom: spacing.sm,
  },
  skelLineLg: {
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    width: '88%',
    marginBottom: spacing.md,
  },
  skelRow: { flexDirection: 'row', gap: spacing.sm },
  skelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  skelCol: { flex: 1, gap: 8, justifyContent: 'center' },
  skelLineMd: { height: 14, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.12)', width: '70%' },
  skelLineSm: { height: 12, borderRadius: 6, backgroundColor: 'rgba(255, 101, 132, 0.1)', width: '45%' },
});
