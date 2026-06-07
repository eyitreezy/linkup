/**
 * Discovery feed — swipe-first meetup ideas + list mode; filters live in the filter sheet.
 */
import { MoodTimelineCarousel } from '@/components/discovery/MoodTimelineCarousel';
import { PlansSwipeDeck, type PlansSwipeDeckRef } from '@/components/discovery/PlansSwipeDeck';
import { SwipeActionButtons } from '@/components/discovery/SwipeActionButtons';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { NearbyPlansHeader, type FeedViewMode } from '@/components/plans/NearbyPlansHeader';
import { PlanCard } from '@/components/plans/PlanCard';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { PlansFilterSheet, type FeedFilterState } from '@/components/plans/PlansFilterSheet';
import { PlansEmptyState } from '@/components/plans/PlansEmptyState';
import { PlansFab } from '@/components/plans/PlansFab';
import { PlansFeedSkeleton } from '@/components/plans/PlansFeedSkeleton';
import { PlansKycBanner } from '@/components/plans/PlansKycBanner';
import { PlansLocationPrompt } from '@/components/plans/PlansLocationPrompt';
import { PremiumFeaturePaywallModal } from '@/components/premium/PremiumFeaturePaywallModal';
import { PlansSearchBar } from '@/components/plans/PlansSearchBar';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { parseStoredFeedFilters } from '@/lib/discovery/parseStoredFeedFilters';
import { filterPlansByMood, type DiscoveryMood } from '@/lib/discovery/moodFilter';
import { distanceKm } from '@/lib/location';
import { fetchLatestBidderOffersByPlanIds } from '@/lib/plans/fetchLatestBidderOffersByPlans';
import {
  fetchPlansPage,
  fetchProfilesForCreators,
  mergePlansWithProfiles,
  type PlanRowFromDb,
} from '@/lib/plans/planFeedMerge';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { prefetchPlanDetail, seedPlanDetailFromFeed } from '@/lib/plans/planDetailSeed';
import { derivePresenceUi, hostPresenceMatchesFilter, resolveHostPresenceKind } from '@/lib/presence/derivePresenceUi';
import { fetchPresenceMap } from '@/lib/presence/presenceHeartbeat';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isUserVerified, requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlanOffer, DbProfile, DbUserPresence } from '@/types/database';
import { Href, router } from 'expo-router';
import * as Location from 'expo-location';
import { DEFAULT_TAB_BAR_INSET, useTabBarVisibilityOptional } from '@/contexts/TabBarVisibilityContext';
import { useShowTabBarOnFocus, useTabBarScrollProps } from '@/hooks/useTabBarScrollHandler';
import { useFocusEffect } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type ListRenderItemInfo,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

const PAGE_SIZE = 12;
const FEED_MODE_STORAGE_KEY = 'linkup_discovery_feed_mode';

function dedupePlans(existing: PlanRowFromDb[], incoming: PlanRowFromDb[]): PlanRowFromDb[] {
  const m = new Map(existing.map((p) => [p.id, p]));
  for (const p of incoming) m.set(p.id, p);
  return Array.from(m.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

type DiscoverPlanListRowProps = {
  row: PlanFeedRow;
  distanceKm: number | null;
  currentUserId: string | undefined;
  userOffer: DbPlanOffer | undefined;
  viewerProfile: DbProfile | null;
  creatorPresence: DbUserPresence | null;
  subscriber: boolean;
  onOpenPlan: (row: PlanFeedRow) => void;
  onOfferRow: (row: PlanFeedRow) => void;
  onDismissRow: (id: string) => void;
};

/** Isolated row so PlanCard’s memo survives parent feed updates (VirtualizedList perf). */
const DiscoverPlanListRow = memo(function DiscoverPlanListRow({
  row,
  distanceKm: dist,
  currentUserId,
  userOffer,
  viewerProfile,
  creatorPresence,
  subscriber,
  onOpenPlan,
  onOfferRow,
  onDismissRow,
}: DiscoverPlanListRowProps) {
  const onPressCard = useCallback(() => onOpenPlan(row), [row, onOpenPlan]);
  const onPressAvatar = useCallback(() => {
    router.push(`/user/${row.creator_id}` as Href);
  }, [row.creator_id]);
  const onPressOffer = useCallback(() => onOfferRow(row), [row, onOfferRow]);
  const onDismiss = useCallback(() => onDismissRow(row.id), [row.id, onDismissRow]);
  return (
    <PlanCard
      row={row}
      distanceKm={dist}
      currentUserId={currentUserId}
      userOffer={userOffer}
      viewerProfile={viewerProfile}
      creatorPresence={creatorPresence}
      onPressCard={onPressCard}
      onPressAvatar={onPressAvatar}
      onPressOffer={onPressOffer}
      onDismissFromFeed={subscriber ? onDismiss : undefined}
      warmTone
      datingList
    />
  );
});

export default function PlansScreen() {
  useShowTabBarOnFocus();
  const tabBarScroll = useTabBarScrollProps();
  const tabBarInset = useTabBarVisibilityOptional()?.tabBarInset ?? DEFAULT_TAB_BAR_INSET;
  /** Pass / like / info row (~68px buttons + vertical padding). */
  const swipeActionsClearance = 88;
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
  const accRef = useRef<PlanRowFromDb[]>([]);

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
    minPriceCents: null,
    maxPriceCents: null,
    verifiedHostsOnly: false,
    hostPresence: 'all',
    clientFiltersActive: false,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [travelPaywallOpen, setTravelPaywallOpen] = useState(false);
  const [hiddenPlanIds, setHiddenPlanIds] = useState<string[]>([]);
  const [lastHiddenId, setLastHiddenId] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [bidderOffersByPlan, setBidderOffersByPlan] = useState<Record<string, DbPlanOffer>>({});
  const [presenceByUser, setPresenceByUser] = useState<Record<string, DbUserPresence>>({});
  const offerFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [feedMode, setFeedMode] = useState<FeedViewMode>('swipe');
  const [discoveryMood, setDiscoveryMood] = useState<DiscoveryMood>('all');
  const [swipeIndex, setSwipeIndex] = useState(0);
  const swipeDeckRef = useRef<PlansSwipeDeckRef>(null);

  const unverified = !!(dbUser && !isUserVerified(dbUser.verification_status));

  useEffect(() => {
    void AsyncStorage.getItem(FEED_MODE_STORAGE_KEY).then((raw) => {
      if (raw === 'list' || raw === 'swipe') setFeedMode(raw);
    });
  }, []);

  const persistFeedMode = useCallback((mode: FeedViewMode) => {
    setFeedMode(mode);
    void AsyncStorage.setItem(FEED_MODE_STORAGE_KEY, mode);
  }, []);

  const onDebouncedSearchChange = useCallback((q: string) => {
    setDebouncedSearchQuery(q);
  }, []);

  useEffect(() => {
    const f = profile?.preferences?.feed_filters;
    if (f && typeof f === 'object') {
      const parsed = parseStoredFeedFilters(f, radiusKm);
      setFeedFilter(parsed);
    }
  }, [profile?.preferences, radiusKm]);

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
      if (row.is_mood_plan && isPlanMoodWindowClosed(row)) return false;
      if (row.is_suppressed) return false;
      if (row.archived_at != null) return false;
      if (hidden.has(row.id)) return false;
      if (blocked.has(row.creator_id)) return false;
      if (user?.id && row.creator_id === user.id) return true;
      if (feedFilter.clientFiltersActive) {
        if (feedFilter.verifiedHostsOnly && !row.creatorProfile?.verified_badge) return false;
        const price = row.starting_price_cents;
        if (feedFilter.minPriceCents != null) {
          if (price == null || price < feedFilter.minPriceCents) return false;
        }
        if (feedFilter.maxPriceCents != null) {
          if (price != null && price > feedFilter.maxPriceCents) return false;
        }
        if (
          row.latitude != null &&
          row.longitude != null &&
          effectiveLat != null &&
          effectiveLng != null
        ) {
          const d = distanceKm(effectiveLat, effectiveLng, row.latitude, row.longitude);
          if (d > maxKm) return false;
        }
      }
      return true;
    });

    const nowMs = Date.now();
    const isBoosted = (p: PlanFeedRow) =>
      !!(p.boosted_until && new Date(p.boosted_until).getTime() > nowMs);
    const moodDeadline = (p: PlanFeedRow) =>
      p.is_mood_plan && p.mood_expires_at ? new Date(p.mood_expires_at).getTime() : Infinity;

    if (effectiveLat != null && effectiveLng != null) {
      merged = [...merged].sort((a, b) => {
        if (a.is_mood_plan !== b.is_mood_plan) return a.is_mood_plan ? -1 : 1;
        if (a.is_mood_plan && b.is_mood_plan) {
          const ma = moodDeadline(a);
          const mb = moodDeadline(b);
          if (ma !== mb) return ma - mb;
        }
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
      merged = [...merged].sort((a, b) => {
        if (a.is_mood_plan !== b.is_mood_plan) return a.is_mood_plan ? -1 : 1;
        if (a.is_mood_plan && b.is_mood_plan) {
          const ma = moodDeadline(a);
          const mb = moodDeadline(b);
          if (ma !== mb) return ma - mb;
        }
        return Number(isBoosted(b)) - Number(isBoosted(a));
      });
    }
    setRows(merged);
  }, [
    user?.id,
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
      if (user?.id && r.creator_id === user.id) continue;
      ids.add(r.creator_id);
    }
    return [...ids].sort().join('|');
  }, [rows, user?.id]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setPresenceByUser({});
      return;
    }
    const ids = presenceCreatorKey ? presenceCreatorKey.split('|').filter(Boolean) : [];
    if (ids.length === 0) {
      setPresenceByUser({});
      return;
    }
    void fetchPresenceMap(ids).then(setPresenceByUser).catch(() => setPresenceByUser({}));
  }, [user?.id, presenceCreatorKey]);

  const presenceForRow = useCallback(
    (row: PlanFeedRow) =>
      derivePresenceUi(
        profile ?? null,
        row.creatorProfile?.preferences,
        presenceByUser[row.creator_id] ?? null
      ),
    [profile, presenceByUser]
  );

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

  const moodFilteredRows = useMemo(
    () => filterPlansByMood(filteredRows, discoveryMood),
    [filteredRows, discoveryMood]
  );

  const presenceFilteredRows = useMemo(() => {
    if (feedFilter.hostPresence === 'all') return moodFilteredRows;
    return moodFilteredRows.filter((row) => {
      if (user?.id && row.creator_id === user.id) return true;
      const kind = resolveHostPresenceKind(
        profile ?? null,
        row.creatorProfile?.preferences,
        presenceByUser[row.creator_id] ?? null
      );
      return hostPresenceMatchesFilter(kind, feedFilter.hostPresence);
    });
  }, [moodFilteredRows, feedFilter.hostPresence, presenceByUser, profile, user?.id]);

  const moodTimelineRows = useMemo(
    () => presenceFilteredRows.filter((r) => r.is_mood_plan && !isPlanMoodWindowClosed(r)),
    [presenceFilteredRows]
  );

  const standardDiscoverRows = useMemo(
    () => presenceFilteredRows.filter((r) => !r.is_mood_plan),
    [presenceFilteredRows]
  );

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
      const { plans: newPlans, error: fetchErr } = await fetchPlansPage(
        0,
        PAGE_SIZE - 1,
        user?.id ?? null
      );
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
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setSwipeIndex(0);
    setRefreshing(true);
    setError(null);
    pageRef.current = 0;
    accRef.current = [];
    setHasMore(true);
    const { plans: newPlans, error: fetchErr } = await fetchPlansPage(0, PAGE_SIZE - 1, user?.id ?? null);
    if (fetchErr) {
      setError(fetchErr);
      setRefreshing(false);
      return;
    }
    accRef.current = dedupePlans([], newPlans);
    pageRef.current = 1;
    setHasMore(newPlans.length === PAGE_SIZE);
    await rebuildRowsRef.current();
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
  }, [user?.id]);

  const firstDiscoverFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      if (firstDiscoverFocusRef.current) {
        firstDiscoverFocusRef.current = false;
        return;
      }
      void onRefresh();
    }, [isSupabaseConfigured, onRefresh])
  );

  const feedReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Unique topic per effect run — avoids `.on()` after `subscribe()` on React reconnect. */
  const discoverPlansRealtimeRunRef = useRef(0);
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    discoverPlansRealtimeRunRef.current += 1;
    const channelName = `discover-plans-ttl-${user?.id ?? 'anon'}-${discoverPlansRealtimeRunRef.current}`;
    const ch = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans' },
        (payload) => {
          const row = payload.new as {
            id?: string;
            is_suppressed?: boolean;
            archived_at?: string | null;
          };
          if (row?.id) {
            const hid = row.is_suppressed === true || (row.archived_at != null && row.archived_at !== '');
            if (hid) {
              accRef.current = accRef.current.filter((p) => p.id !== row.id);
            } else {
              const idx = accRef.current.findIndex((p) => p.id === row.id);
              if (idx >= 0) {
                accRef.current[idx] = { ...accRef.current[idx], ...row };
              }
            }
          }
          if (feedReloadTimerRef.current) clearTimeout(feedReloadTimerRef.current);
          feedReloadTimerRef.current = setTimeout(() => {
            feedReloadTimerRef.current = null;
            void rebuildRowsRef.current();
          }, 450);
        }
      )
      .subscribe();

    return () => {
      if (feedReloadTimerRef.current) clearTimeout(feedReloadTimerRef.current);
      void supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || initialLoading || error || !isSupabaseConfigured) return;
    setLoadingMore(true);
    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { plans: newPlans, error: fetchErr } = await fetchPlansPage(from, to, user?.id ?? null);
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
  }, [error, hasMore, initialLoading, loadingMore, user?.id]);

  function openCreateGate() {
    setGateTitle('Quick verification');
    setGateMessage('So people feel safe meeting in person — it only takes a minute.');
    setGateOpen(true);
  }

  function openOfferGate() {
    setGateTitle('Almost there');
    setGateMessage('Verify so you can suggest details and keep chatting comfortably.');
    setGateOpen(true);
  }

  function goCreatePlan() {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      openCreateGate();
      return;
    }
    router.push('/plan/create' as Href);
  }

  const openPlanFromFeed = useCallback((row: PlanFeedRow) => {
    seedPlanDetailFromFeed(row);
    router.push(`/plan/${row.id}` as Href);
  }, []);

  const onPressOffer = useCallback(
    (row: PlanFeedRow) => {
      if (requiresVerificationGate(dbUser?.verification_status)) {
        openOfferGate();
        return;
      }
      openPlanFromFeed(row);
    },
    [dbUser?.verification_status, openPlanFromFeed]
  );

  const onAllowLocation = useCallback(async () => {
    const r = await Location.requestForegroundPermissionsAsync();
    setPerm(r.status);
    if (r.status === 'granted') await syncLocation();
  }, [syncLocation]);

  const retryLoad = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setError(null);
    setInitialLoading(true);
    pageRef.current = 0;
    accRef.current = [];
    const { plans: newPlans, error: fetchErr } = await fetchPlansPage(0, PAGE_SIZE - 1, user?.id ?? null);
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
  }, [user?.id]);

  const showLocPrompt = perm != null && perm !== 'granted' && !locPromptDismissed;

  const dismissRow = useCallback(
    (id: string) => {
      if (!subscriber) {
        router.push('/premium' as Href);
        return;
      }
      setHiddenPlanIds((prev) => [...prev, id]);
      setLastHiddenId(id);
    },
    [subscriber]
  );

  function undoHide() {
    if (!lastHiddenId) return;
    setHiddenPlanIds((prev) => prev.filter((x) => x !== lastHiddenId));
    setLastHiddenId(null);
  }

  const onPressDiscoverLocation = useCallback(() => {
    if (subscriber) {
      router.push('/settings/travel' as Href);
      return;
    }
    setTravelPaywallOpen(true);
  }, [subscriber]);

  const onGoPremiumFromTravelPaywall = useCallback(() => {
    setTravelPaywallOpen(false);
    router.push('/premium' as Href);
  }, []);

  const feedBanner = useMemo(
    () => (
      <>
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
        <MoodTimelineCarousel rows={moodTimelineRows} onOpenPlan={openPlanFromFeed} />
      </>
    ),
    [unverified, showLocPrompt, error, onAllowLocation, retryLoad, moodTimelineRows, openPlanFromFeed]
  );

  const searchActive = debouncedSearchQuery.trim().length > 0;

  useEffect(() => {
    if (feedMode === 'swipe') setDebouncedSearchQuery('');
  }, [feedMode]);

  useEffect(() => {
    setSwipeIndex(0);
  }, [debouncedSearchQuery, discoveryMood]);

  const onSwipeInterested = useCallback((row: PlanFeedRow) => {
    openPlanFromFeed(row);
  }, [openPlanFromFeed]);

  const onSwipePass = useCallback(
    (row: PlanFeedRow) => {
      if (subscriber) {
        setHiddenPlanIds((prev) => [...prev, row.id]);
        setLastHiddenId(row.id);
      }
    },
    [subscriber]
  );

  const listEmpty =
    initialLoading ? (
      <PlansFeedSkeleton />
    ) : error ? null : filteredRows.length > 0 && moodFilteredRows.length === 0 ? (
      <View style={styles.moodEmpty}>
        <Text style={styles.moodEmptyTitle}>Nothing in this vibe yet</Text>
        <Text style={styles.moodEmptySub}>Try another mood or switch back to All.</Text>
      </View>
    ) : searchActive && standardDiscoverRows.length === 0 ? (
      <View style={styles.searchEmpty}>
        <Text style={styles.searchEmptyTitle}>Nothing in that vibe yet</Text>
        <Text style={styles.searchEmptySub}>
          Try a looser keyword or clear search — the best plans are often one word away.
        </Text>
      </View>
    ) : standardDiscoverRows.length === 0 && moodTimelineRows.length > 0 ? (
      <View style={styles.moodEmpty}>
        <Text style={styles.moodEmptyTitle}>Mood moments in the timeline</Text>
        <Text style={styles.moodEmptySub}>Swipe the timeline for sparks on a countdown — longer meetups land in the deck.</Text>
      </View>
    ) : (
      <PlansEmptyState onCreatePress={goCreatePlan} />
    );

  const distanceForRow = useCallback(
    (row: PlanFeedRow): number | null => {
      if (row.latitude == null || row.longitude == null || effectiveLat == null || effectiveLng == null)
        return null;
      return distanceKm(effectiveLat, effectiveLng, row.latitude, row.longitude);
    },
    [effectiveLat, effectiveLng]
  );

  const discoverListKeyExtractor = useCallback((item: PlanFeedRow) => item.id, []);

  const renderDiscoverListItem = useCallback(
    ({ item }: ListRenderItemInfo<PlanFeedRow>) => (
      <DiscoverPlanListRow
        row={item}
        distanceKm={distanceForRow(item)}
        currentUserId={user?.id}
        userOffer={bidderOffersByPlan[item.id]}
        viewerProfile={profile}
        creatorPresence={presenceByUser[item.creator_id] ?? null}
        subscriber={subscriber}
        onOpenPlan={openPlanFromFeed}
        onOfferRow={onPressOffer}
        onDismissRow={dismissRow}
      />
    ),
    [
      distanceForRow,
      user?.id,
      bidderOffersByPlan,
      profile,
      presenceByUser,
      subscriber,
      openPlanFromFeed,
      onPressOffer,
      dismissRow,
    ]
  );

  const showSwipe = feedMode === 'swipe' && !error;

  const { height: winH } = useWindowDimensions();
  const hasMoodLane = moodTimelineRows.length > 0;
  const swipeDeckMinHeight = useMemo(() => {
    const moodLaneH = hasMoodLane ? 76 : 0;
    const headerH = 52;
    const actionsH = 76;
    const buffer = 16;
    const overhead = headerH + moodLaneH + actionsH + swipeActionsClearance + tabBarInset + buffer;
    return Math.max(440, Math.round(winH - overhead));
  }, [winH, hasMoodLane, tabBarInset, swipeActionsClearance]);

  useEffect(() => {
    if (!showSwipe || !hasMore || loadingMore || initialLoading || error) return;
    const remaining = standardDiscoverRows.length - swipeIndex;
    if (remaining <= 3) void onEndReached();
  }, [
    showSwipe,
    standardDiscoverRows.length,
    swipeIndex,
    hasMore,
    loadingMore,
    initialLoading,
    error,
    onEndReached,
  ]);

  useEffect(() => {
    if (!showSwipe || standardDiscoverRows.length === 0) return;
    for (let i = 0; i < 3; i += 1) {
      const row = standardDiscoverRows[swipeIndex + i];
      if (row) prefetchPlanDetail(row.id);
    }
  }, [showSwipe, swipeIndex, standardDiscoverRows]);

  return (
    <Screen
      safeAreaEdges={['top', 'left', 'right']}
      safeAreaStyle={styles.screenBg}
      style={styles.screenBg}
    >
      <LinearGradient
        colors={[colors.discoveryGradientTop, colors.discoveryGradientMid, colors.discoveryGradientBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBg}
      />
      {filterOpen ? (
        <PlansFilterSheet
          visible
          onClose={() => setFilterOpen(false)}
          isPremium={subscriber}
          initial={feedFilter}
          discoveryMood={discoveryMood}
          feedMode={feedMode}
          baseRadiusKm={radiusKm}
          onUpgrade={() => {
            setFilterOpen(false);
            router.push('/premium' as Href);
          }}
          onApply={(next, nextMood, nextFeedMode) => {
            setFeedFilter(next);
            setDiscoveryMood(nextMood);
            persistFeedMode(nextFeedMode);
            setSwipeIndex(0);
            if (user && isSupabaseConfigured) {
              void supabase
                .from('profiles')
                .update({
                  preferences: {
                    ...(profile?.preferences ?? {}),
                    feed_filters: {
                      maxDistanceKm: next.maxDistanceKm,
                      minPriceCents: next.minPriceCents,
                      maxPriceCents: next.maxPriceCents,
                      verifiedHostsOnly: next.verifiedHostsOnly,
                      hostPresence: next.hostPresence,
                      clientFiltersActive: next.clientFiltersActive,
                    },
                  },
                })
                .eq('user_id', user.id);
            }
          }}
        />
      ) : null}
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
        title={gateTitle}
        message={gateMessage}
      />
      <PremiumFeaturePaywallModal
        visible={travelPaywallOpen}
        onClose={() => setTravelPaywallOpen(false)}
        onGoPremium={onGoPremiumFromTravelPaywall}
        kicker="Travel mode"
        title="Explore anywhere"
        message="Subscribe to Premium to browse meetups as if you were in another city. Your home base stays saved — turn travel mode off anytime."
      />
      <NearbyPlansHeader
        locationLabel={headerLocationLabel}
        onPressLocation={onPressDiscoverLocation}
        onPressFilter={() => setFilterOpen(true)}
        showUndo={subscriber && !!lastHiddenId}
        onUndoLastHide={undoHide}
      />
      {feedMode === 'list' ? (
        <PlansSearchBar
          onDebouncedQueryChange={onDebouncedSearchChange}
          variant="premium"
          placeholder="Search vibes, plans, or neighborhoods"
        />
      ) : null}
      {showSwipe && !initialLoading ? (
        <View style={styles.swipeColumn}>
          <View style={styles.swipeFeedStrip}>{feedBanner}</View>
          {filteredRows.length === 0 ? (
            listEmpty
          ) : standardDiscoverRows.length === 0 ? (
            moodTimelineRows.length > 0 ? (
              <View style={styles.moodEmpty}>
                <Text style={styles.moodEmptyTitle}>Mood moments in the timeline</Text>
                <Text style={styles.moodEmptySub}>Explore the timeline — swipe the deck refreshes when longer meetups appear.</Text>
              </View>
            ) : moodFilteredRows.length === 0 ? (
              <View style={styles.moodEmpty}>
                <Text style={styles.moodEmptyTitle}>Nothing in this vibe yet</Text>
                <Text style={styles.moodEmptySub}>Open Filters to try another vibe or choose All.</Text>
              </View>
            ) : (
              listEmpty
            )
          ) : (
            <>
              <View style={styles.swipeDeckZone}>
                <PlansSwipeDeck
                  ref={swipeDeckRef}
                  items={standardDiscoverRows}
                  index={swipeIndex}
                  onIndexChange={setSwipeIndex}
                  distanceForRow={distanceForRow}
                  presenceForRow={presenceForRow}
                  onSwipeRight={onSwipeInterested}
                  onSwipeLeft={onSwipePass}
                  onPressCard={(row) => openPlanFromFeed(row)}
                  minDeckHeight={swipeDeckMinHeight}
                />
              </View>
              <View style={[styles.swipeActionsZone, { paddingBottom: tabBarInset + spacing.xs }]}>
                <SwipeActionButtons
                  onPass={() => swipeDeckRef.current?.swipeLeft()}
                  onLike={() => swipeDeckRef.current?.swipeRight()}
                  onInfo={() => {
                    const row = standardDiscoverRows[swipeIndex];
                    if (row) openPlanFromFeed(row);
                  }}
                />
              </View>
            </>
          )}
          {loadingMore ? (
            <ActivityIndicator style={styles.footerSpinner} color={colors.primary} />
          ) : null}
        </View>
      ) : (
        <Animated.FlatList
          style={styles.list}
          data={standardDiscoverRows}
          keyExtractor={discoverListKeyExtractor}
          ListHeaderComponent={feedBanner}
          contentContainerStyle={styles.listContentPremium}
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
          renderItem={renderDiscoverListItem}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.footerSpinner} color={colors.primary} />
            ) : null
          }
          {...tabBarScroll}
        />
      )}
      <PlansFab
        onPress={goCreatePlan}
        bottomOffset={
          showSwipe && !initialLoading && (standardDiscoverRows.length > 0 || moodTimelineRows.length > 0)
            ? tabBarInset + swipeActionsClearance + spacing.sm
            : tabBarInset + spacing.md
        }
        includeSafeAreaInset={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenBg: { backgroundColor: 'transparent' },
  gradientBg: { ...StyleSheet.absoluteFillObject },
  swipeColumn: { flex: 1, minHeight: 0 },
  swipeFeedStrip: { flexShrink: 0, flexGrow: 0 },
  swipeDeckZone: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  swipeActionsZone: {
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  list: { flex: 1, backgroundColor: 'transparent' },
  listContentPremium: { paddingBottom: 120, flexGrow: 1, paddingTop: spacing.xs },
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
  moodEmpty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    marginTop: spacing.md,
  },
  moodEmptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  moodEmptySub: {
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
