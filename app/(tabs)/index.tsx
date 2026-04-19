/**
 * Nearby Plans feed — default home after onboarding (Plans tab).
 */
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { EngagementCarousel } from '@/components/plans/EngagementCarousel';
import { NearbyPlansHeader } from '@/components/plans/NearbyPlansHeader';
import { PlanCard } from '@/components/plans/PlanCard';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { PlansFilterSheet, type FeedFilterState } from '@/components/plans/PlansFilterSheet';
import { PlansEmptyState } from '@/components/plans/PlansEmptyState';
import { PlansFab } from '@/components/plans/PlansFab';
import { PlansFeedSkeleton } from '@/components/plans/PlansFeedSkeleton';
import { PlansKycBanner } from '@/components/plans/PlansKycBanner';
import { PlansLocationPrompt } from '@/components/plans/PlansLocationPrompt';
import { PlansSearchBar } from '@/components/plans/PlansSearchBar';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { distanceKm } from '@/lib/location';
import { fetchFeedEngagementCarousel, type EngagementCarouselItem } from '@/lib/plans/fetchFeedEngagementCarousel';
import { fetchLatestBidderOffersByPlanIds } from '@/lib/plans/fetchLatestBidderOffersByPlans';
import {
  fetchPlansPage,
  fetchProfilesForCreators,
  mergePlansWithProfiles,
} from '@/lib/plans/planFeedMerge';
import { fetchPresenceMap } from '@/lib/presence/presenceHeartbeat';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isUserVerified, requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlan, DbPlanOffer, DbUserPresence } from '@/types/database';
import { Href, router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PAGE_SIZE = 12;

function dedupePlans(existing: DbPlan[], incoming: DbPlan[]): DbPlan[] {
  const m = new Map(existing.map((p) => [p.id, p]));
  for (const p of incoming) m.set(p.id, p);
  return Array.from(m.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default function PlansScreen() {
  const { user, profile, dbUser } = useAuth();
  const [rows, setRows] = useState<PlanFeedRow[]>([]);
  const [perm, setPerm] = useState<Location.PermissionStatus | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cityLabel, setCityLabel] = useState('Near you');
  const [locPromptDismissed, setLocPromptDismissed] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateTitle, setGateTitle] = useState<string | undefined>();
  const [gateMessage, setGateMessage] = useState<string | undefined>();

  const pageRef = useRef(0);
  const accRef = useRef<DbPlan[]>([]);

  const radiusKm = profile?.radius_km ? Number(profile.radius_km) : 50;
  const userLat = coords?.lat ?? profile?.latitude ?? null;
  const userLng = coords?.lng ?? profile?.longitude ?? null;
  const subscriber = isPremiumSubscriber(dbUser);
  const travel = profile?.preferences?.travel_mode ?? null;
  const effectiveLat =
    subscriber && travel?.latitude != null ? travel.latitude : userLat;
  const effectiveLng =
    subscriber && travel?.longitude != null ? travel.longitude : userLng;
  const headerLocationLabel =
    subscriber && travel?.label ? `${travel.label} · Travel` : cityLabel;

  const [feedFilter, setFeedFilter] = useState<FeedFilterState>({
    maxDistanceKm: radiusKm,
    maxPriceCents: null,
    verifiedHostsOnly: false,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [hiddenPlanIds, setHiddenPlanIds] = useState<string[]>([]);
  const [lastHiddenId, setLastHiddenId] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [engagementItems, setEngagementItems] = useState<EngagementCarouselItem[]>([]);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [bidderOffersByPlan, setBidderOffersByPlan] = useState<Record<string, DbPlanOffer>>({});
  const [presenceByUser, setPresenceByUser] = useState<Record<string, DbUserPresence>>({});
  const offerFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unverified = !!(dbUser && !isUserVerified(dbUser.verification_status));

  const onDebouncedSearchChange = useCallback((q: string) => {
    setDebouncedSearchQuery(q);
  }, []);

  const loadEngagementCarousel = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setEngagementItems([]);
      setEngagementLoading(false);
      return;
    }
    setEngagementLoading(true);
    try {
      const data = await fetchFeedEngagementCarousel(user.id);
      setEngagementItems(data);
    } catch {
      setEngagementItems([]);
    } finally {
      setEngagementLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadEngagementCarousel();
    }, [loadEngagementCarousel])
  );

  useEffect(() => {
    const f = profile?.preferences?.feed_filters;
    if (f && typeof f === 'object') {
      setFeedFilter((prev) => ({
        maxDistanceKm: f.maxDistanceKm ?? prev.maxDistanceKm,
        maxPriceCents: f.maxPriceCents ?? null,
        verifiedHostsOnly: !!f.verifiedHostsOnly,
      }));
    }
  }, [profile?.preferences]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;
    void (async () => {
      const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id);
      setBlockedIds((data ?? []).map((r) => r.blocked_id as string));
    })();
  }, [user?.id]);

  const rebuildRows = useCallback(async () => {
    if (accRef.current.length === 0) {
      setRows([]);
      return;
    }
    const ids = accRef.current.map((p) => p.creator_id);
    const profMap = await fetchProfilesForCreators(ids);
    let merged = mergePlansWithProfiles(accRef.current, profMap);
    const blocked = new Set(blockedIds);
    const hidden = new Set(hiddenPlanIds);
    const maxKm = feedFilter.maxDistanceKm ?? radiusKm;

    merged = merged.filter((row) => {
      if (hidden.has(row.id)) return false;
      if (blocked.has(row.creator_id)) return false;
      if (feedFilter.verifiedHostsOnly && !row.creatorProfile?.verified_badge) return false;
      if (
        feedFilter.maxPriceCents != null &&
        row.starting_price_cents != null &&
        row.starting_price_cents > feedFilter.maxPriceCents
      ) {
        return false;
      }
      if (row.latitude == null || row.longitude == null || effectiveLat == null || effectiveLng == null)
        return true;
      const d = distanceKm(effectiveLat, effectiveLng, row.latitude, row.longitude);
      return d <= maxKm;
    });

    const nowMs = Date.now();
    const isBoosted = (p: PlanFeedRow) =>
      !!(p.boosted_until && new Date(p.boosted_until).getTime() > nowMs);

    if (effectiveLat != null && effectiveLng != null) {
      merged = [...merged].sort((a, b) => {
        const ba = isBoosted(a) ? 1 : 0;
        const bb = isBoosted(b) ? 1 : 0;
        if (ba !== bb) return bb - ba;
        if (a.latitude == null || a.longitude == null) return 1;
        if (b.latitude == null || b.longitude == null) return -1;
        const da = distanceKm(effectiveLat, effectiveLng, a.latitude, a.longitude);
        const db = distanceKm(effectiveLat, effectiveLng, b.latitude, b.longitude);
        return da - db;
      });
    } else {
      merged = [...merged].sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)));
    }
    setRows(merged);
  }, [
    radiusKm,
    effectiveLat,
    effectiveLng,
    feedFilter,
    hiddenPlanIds,
    blockedIds,
  ]);

  const rebuildRowsRef = useRef(rebuildRows);
  rebuildRowsRef.current = rebuildRows;

  useEffect(() => {
    void rebuildRows();
  }, [rebuildRows]);

  const rowIdsKey = useMemo(() => rows.map((r) => r.id).join('|'), [rows]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setBidderOffersByPlan({});
      return;
    }
    if (rows.length === 0) {
      setBidderOffersByPlan({});
      return;
    }
    if (offerFetchTimerRef.current) clearTimeout(offerFetchTimerRef.current);
    offerFetchTimerRef.current = setTimeout(() => {
      const ids = rows.map((r) => r.id);
      void fetchLatestBidderOffersByPlanIds(user.id, ids)
        .then(setBidderOffersByPlan)
        .catch(() => setBidderOffersByPlan({}));
    }, 380);
    return () => {
      if (offerFetchTimerRef.current) clearTimeout(offerFetchTimerRef.current);
    };
  }, [user?.id, rowIdsKey]);

  const presenceCreatorKey = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      if (bidderOffersByPlan[r.id]) ids.add(r.creator_id);
    }
    return [...ids].sort().join('|');
  }, [rows, bidderOffersByPlan]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setPresenceByUser({});
      return;
    }
    const ids = [...new Set(rows.filter((r) => bidderOffersByPlan[r.id]).map((r) => r.creator_id))];
    if (ids.length === 0) {
      setPresenceByUser({});
      return;
    }
    void fetchPresenceMap(ids).then(setPresenceByUser).catch(() => setPresenceByUser({}));
  }, [user?.id, presenceCreatorKey]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const t = (r.title ?? '').toLowerCase();
      const d = (r.description ?? '').toLowerCase();
      const c = (r.category ?? '').toLowerCase();
      return t.includes(q) || d.includes(q) || c.includes(q);
    });
  }, [rows, debouncedSearchQuery]);

  const syncLocation = useCallback(async () => {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      setPerm(fg.status);
      if (fg.status !== 'granted') return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const city = place?.city || place?.subregion || place?.region;
        setCityLabel(city && city.length > 0 ? city : 'Near you');
      } catch {
        setCityLabel('Near you');
      }
    } catch {
      // Permission can be granted while GPS / device location is off — avoid crashing the tab.
      setCoords(null);
      setCityLabel('Near you');
    }
  }, []);

  useEffect(() => {
    void syncLocation();
  }, [syncLocation]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setError('App is not connected.');
          setInitialLoading(false);
        }
        return;
      }
      const { plans: newPlans, error: fetchErr } = await fetchPlansPage(0, PAGE_SIZE - 1);
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr);
        setInitialLoading(false);
        return;
      }
      accRef.current = dedupePlans([], newPlans);
      pageRef.current = 1;
      setHasMore(newPlans.length === PAGE_SIZE);
      setError(null);
      await rebuildRowsRef.current();
      if (!cancelled) setInitialLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setRefreshing(true);
    setError(null);
    pageRef.current = 0;
    accRef.current = [];
    setHasMore(true);
    const { plans: newPlans, error: fetchErr } = await fetchPlansPage(0, PAGE_SIZE - 1);
    if (fetchErr) {
      setError(fetchErr);
      setRefreshing(false);
      return;
    }
    accRef.current = dedupePlans([], newPlans);
    pageRef.current = 1;
    setHasMore(newPlans.length === PAGE_SIZE);
    await rebuildRowsRef.current();
    await loadEngagementCarousel();
    if (user?.id) {
      const ids = accRef.current.map((p) => p.id);
      if (ids.length > 0) {
        try {
          const m = await fetchLatestBidderOffersByPlanIds(user.id, ids);
          setBidderOffersByPlan(m);
        } catch {
          /* keep map */
        }
      } else {
        setBidderOffersByPlan({});
      }
    }
    setRefreshing(false);
  }, [loadEngagementCarousel, user?.id]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || initialLoading || error || !isSupabaseConfigured) return;
    setLoadingMore(true);
    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { plans: newPlans, error: fetchErr } = await fetchPlansPage(from, to);
    if (fetchErr) {
      setError(fetchErr);
      setLoadingMore(false);
      return;
    }
    if (newPlans.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }
    accRef.current = dedupePlans(accRef.current, newPlans);
    pageRef.current += 1;
    setHasMore(newPlans.length === PAGE_SIZE);
    await rebuildRowsRef.current();
    setLoadingMore(false);
  }, [error, hasMore, initialLoading, loadingMore]);

  function openCreateGate() {
    setGateTitle('Verification required to create a plan');
    setGateMessage(undefined);
    setGateOpen(true);
  }

  function openOfferGate() {
    setGateTitle('Verification required');
    setGateMessage('Verify your identity to send offers and negotiate meetups.');
    setGateOpen(true);
  }

  function goCreatePlan() {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      openCreateGate();
      return;
    }
    router.push('/plan/create' as Href);
  }

  function onPressOffer(row: PlanFeedRow) {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      openOfferGate();
      return;
    }
    router.push(`/plan/${row.id}` as Href);
  }

  async function onAllowLocation() {
    const r = await Location.requestForegroundPermissionsAsync();
    setPerm(r.status);
    if (r.status === 'granted') await syncLocation();
  }

  async function retryLoad() {
    if (!isSupabaseConfigured) return;
    setError(null);
    setInitialLoading(true);
    pageRef.current = 0;
    accRef.current = [];
    const { plans: newPlans, error: fetchErr } = await fetchPlansPage(0, PAGE_SIZE - 1);
    if (fetchErr) {
      setError(fetchErr);
      setInitialLoading(false);
      return;
    }
    accRef.current = dedupePlans([], newPlans);
    pageRef.current = 1;
    setHasMore(newPlans.length === PAGE_SIZE);
    await rebuildRowsRef.current();
    setInitialLoading(false);
  }

  const showLocPrompt = perm != null && perm !== 'granted' && !locPromptDismissed;

  function dismissRow(id: string) {
    if (!subscriber) {
      router.push('/premium' as Href);
      return;
    }
    setHiddenPlanIds((prev) => [...prev, id]);
    setLastHiddenId(id);
  }

  function undoHide() {
    if (!lastHiddenId) return;
    setHiddenPlanIds((prev) => prev.filter((x) => x !== lastHiddenId));
    setLastHiddenId(null);
  }

  const listHeader = (
    <>
      <EngagementCarousel items={engagementItems} loading={engagementLoading} />
      {unverified ? <PlansKycBanner visible /> : null}
      {showLocPrompt ? (
        <PlansLocationPrompt
          onAllow={onAllowLocation}
          onNotNow={() => setLocPromptDismissed(true)}
        />
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTxt}>{error}</Text>
          <Text style={styles.retry} onPress={() => void retryLoad()}>
            Tap to retry
          </Text>
        </View>
      ) : null}
    </>
  );

  const searchActive = debouncedSearchQuery.trim().length > 0;
  const listEmpty =
    initialLoading ? (
      <PlansFeedSkeleton />
    ) : error ? null : searchActive ? (
      <View style={styles.searchEmpty}>
        <Text style={styles.searchEmptyTitle}>No plans match your search</Text>
        <Text style={styles.searchEmptySub}>Try different keywords or clear the search bar.</Text>
      </View>
    ) : (
      <PlansEmptyState onCreatePress={goCreatePlan} />
    );

  function distanceForRow(row: PlanFeedRow): number | null {
    if (row.latitude == null || row.longitude == null || effectiveLat == null || effectiveLng == null)
      return null;
    return distanceKm(effectiveLat, effectiveLng, row.latitude, row.longitude);
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <PlansFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        isPremium={subscriber}
        initial={feedFilter}
        baseRadiusKm={radiusKm}
        onUpgrade={() => {
          setFilterOpen(false);
          router.push('/premium' as Href);
        }}
        onApply={(next) => {
          setFeedFilter(next);
          if (user && isSupabaseConfigured) {
            void supabase
              .from('profiles')
              .update({
                preferences: {
                  ...(profile?.preferences ?? {}),
                  feed_filters: {
                    maxDistanceKm: next.maxDistanceKm,
                    maxPriceCents: next.maxPriceCents,
                    verifiedHostsOnly: next.verifiedHostsOnly,
                  },
                },
              })
              .eq('user_id', user.id);
          }
        }}
      />
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
        title={gateTitle}
        message={gateMessage}
      />
      <NearbyPlansHeader
        locationLabel={headerLocationLabel}
        onPressFilter={() => setFilterOpen(true)}
        showUndo={subscriber && !!lastHiddenId}
        onUndoLastHide={undoHide}
      />
      <PlansSearchBar onDebouncedQueryChange={onDebouncedSearchChange} />
      <FlatList
        style={styles.list}
        data={filteredRows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        ListEmptyComponent={listEmpty}
        renderItem={({ item }) => (
          <PlanCard
            row={item}
            distanceKm={distanceForRow(item)}
            currentUserId={user?.id}
            userOffer={bidderOffersByPlan[item.id]}
            viewerProfile={profile}
            creatorPresence={presenceByUser[item.creator_id] ?? null}
            onPressCard={() => router.push(`/plan/${item.id}` as Href)}
            onPressAvatar={() => router.push(`/user/${item.creator_id}` as Href)}
            onPressOffer={() => onPressOffer(item)}
            onDismissFromFeed={subscriber ? () => dismissRow(item.id) : undefined}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footerSpinner} color={colors.primary} />
          ) : null
        }
      />
      <PlansFab onPress={goCreatePlan} bottomOffset={88} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 120, flexGrow: 1 },
  searchEmpty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl * 1.25,
    marginTop: spacing.md,
  },
  searchEmptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  searchEmptySub: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  errorBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 101, 132, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 101, 132, 0.25)',
  },
  errorTxt: { fontSize: 14, color: colors.text, fontWeight: '600' },
  retry: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  footerSpinner: { marginVertical: spacing.lg },
});
