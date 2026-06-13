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
import { SoftKycPrompt } from '@/components/kyc/SoftKycPrompt';
import { SilverTrialWelcomeModal } from '@/components/subscription/SilverTrialWelcomeModal';
import { GoldTrialWelcomeModal } from '@/components/subscription/GoldTrialWelcomeModal';
import { TrialBanner } from '@/components/TrialBanner';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { PremiumFeaturePaywallModal } from '@/components/premium/PremiumFeaturePaywallModal';
import { PlansSearchBar } from '@/components/plans/PlansSearchBar';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { parseStoredFeedFilters } from '@/lib/discovery/parseStoredFeedFilters';
import { swipeFabBottomOffset } from '@/lib/discovery/swipeLayout';
import { filterPlansByMood, type DiscoveryMood } from '@/lib/discovery/moodFilter';
import { distanceKm } from '@/lib/location';
import { fetchLatestBidderOffersByPlanIds } from '@/lib/plans/fetchLatestBidderOffersByPlans';
import {
  fetchPlansPage,
  fetchProfilesForCreators,
  filterPremiumVisibilityPlans,
  mergePlansWithProfiles,
  type PlanRowFromDb,
} from '@/lib/plans/planFeedMerge';
import { effectiveDiscoveryRadiusKm } from '@/lib/plans/discoveryRadius';
import { rankDiscoveryPlans } from '@/lib/plans/feedRanking';
import {
  fetchHiddenPlanIds,
  persistHiddenPlan,
  removeHiddenPlan,
} from '@/lib/plans/hiddenPlans';
import { isPlanMoodWindowClosed, planExpiryReason } from '@/lib/plans/planExpiry';
import { moodReachVisibleToViewer } from '@/lib/plans/moodReachFilter';
import { prefetchPlanDetail, seedPlanDetailFromFeed } from '@/lib/plans/planDetailSeed';
import { derivePresenceUi, hostPresenceMatchesFilter, resolveHostPresenceKind } from '@/lib/presence/derivePresenceUi';
import { fetchPresenceMap } from '@/lib/presence/presenceHeartbeat';
import { usePermission } from '@/hooks/usePermission';
import { hasActiveGoldTrial, hasActiveSilverTrial } from '@/lib/subscription/effectiveTier';
import { peekSoftKycPromptPending, consumeSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import type { SubscriptionTier } from '@/types/database';
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
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

const PAGE_SIZE = 12;
const FEED_MODE_STORAGE_KEY = 'linkup_discovery_feed_mode';
const LOCATION_PROMPT_DISMISSED_KEY = 'linkup_location_prompt_dismissed';

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
  const { allowed: canAdvancedFilters } = usePermission('discover.advanced_filters');
  const { allowed: canTravelMode } = usePermission('discover.travel_mode');
  const { allowed: canUndoSwipe } = usePermission('discover.undo_swipe');
  const { allowed: hasWiderRadius, effectiveTier: discoverTier } = usePermission('discover.wider_radius');
  const browseRadiusKm = useMemo(
    () => effectiveDiscoveryRadiusKm(radiusKm, discoverTier, hasWiderRadius),
    [radiusKm, discoverTier, hasWiderRadius]
  );
  const canDismissSwipe = canUndoSwipe;
  const travel = profile?.preferences?.travel_mode ?? null;
  const effectiveLat =
    canTravelMode && travel?.latitude != null ? travel.latitude : userLat;
  const effectiveLng =
    canTravelMode && travel?.longitude != null ? travel.longitude : userLng;
  const headerLocationLabel =
    canTravelMode && travel?.label ? `${travel.label} · Travel` : cityLabel;

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
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('discover.travel_mode');
  const [upgradeTier, setUpgradeTier] = useState<SubscriptionTier>('GOLD');
  const [silverWelcomeOpen, setSilverWelcomeOpen] = useState(false);
  const [goldWelcomeOpen, setGoldWelcomeOpen] = useState(false);
  const [softKycOpen, setSoftKycOpen] = useState(false);
  type FirstSessionModal = 'silverWelcome' | 'goldWelcome' | 'softKyc';
  const modalQueueRef = useRef<FirstSessionModal[]>([]);
  const [activeModal, setActiveModal] = useState<FirstSessionModal | null>(null);
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
  const viewerTier = (dbUser?.subscription_tier ?? 'FREE') as SubscriptionTier;
  const isIncognitoActive =
    viewerTier === 'PLATINUM' && !!profile?.incognito_browse_enabled;

  useEffect(() => {
    void AsyncStorage.getItem(LOCATION_PROMPT_DISMISSED_KEY).then((v) => {
      if (v === 'true') setLocPromptDismissed(true);
    });
  }, []);

  useEffect(() => {
    if (!user?.id || !canUndoSwipe) return;
    void fetchHiddenPlanIds(user.id).then((ids) => {
      if (ids.length > 0) setHiddenPlanIds(ids);
    });
  }, [user?.id, canUndoSwipe]);

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
      const parsed = parseStoredFeedFilters(f, browseRadiusKm);
      setFeedFilter(parsed);
    }
  }, [profile?.preferences, browseRadiusKm]);

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
    const maxKm = feedFilter.maxDistanceKm ?? browseRadiusKm;

    merged = merged.filter((row) => {
      if (row.is_mood_plan && isPlanMoodWindowClosed(row)) return false;
      if (row.is_suppressed) return false;
      if (row.archived_at != null) return false;
      if (hidden.has(row.id)) return false;
      if (blocked.has(row.creator_id)) return false;
      if (user?.id && row.creator_id === user.id) return true;
      if (
        row.is_mood_plan &&
        !moodReachVisibleToViewer(row, user?.id ?? null, effectiveLat, effectiveLng, maxKm)
      ) {
        return false;
      }
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

    merged = filterPremiumVisibilityPlans(merged, viewerTier);

    merged = rankDiscoveryPlans(merged, {
      effectiveLat,
      effectiveLng,
    });
    setRows(merged);
  }, [
    user?.id,
    browseRadiusKm,
    effectiveLat,
    effectiveLng,
    feedFilter,
    hiddenPlanIds,
    blockedIds,
    viewerTier,
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
        presenceByUser[row.creator_id] ?? null,
        !!row.creatorProfile?.masked_activity_enabled
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
        presenceByUser[row.creator_id] ?? null,
        !!row.creatorProfile?.masked_activity_enabled
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
            status?: string;
            is_suppressed?: boolean;
            archived_at?: string | null;
          };
          if (row?.id) {
            const hid =
              row.is_suppressed === true ||
              (row.archived_at != null && row.archived_at !== '') ||
              (row.status != null &&
                ['agreed', 'active', 'completed', 'cancelled'].includes(row.status));
            if (hid) {
              accRef.current = accRef.current.filter((p) => p.id !== row.id);
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
    if (r.status === 'granted') {
      await AsyncStorage.removeItem(LOCATION_PROMPT_DISMISSED_KEY);
      setLocPromptDismissed(false);
      await syncLocation();
    }
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
      if (!canUndoSwipe) {
        setUpgradeFeature('discover.undo_swipe');
        setUpgradeTier('GOLD');
        setUpgradeOpen(true);
        return;
      }
      setHiddenPlanIds((prev) => [...prev, id]);
      setLastHiddenId(id);
      if (user?.id) persistHiddenPlan(user.id, id);
    },
    [canUndoSwipe, user?.id]
  );

  function undoHide() {
    if (!lastHiddenId) return;
    setHiddenPlanIds((prev) => prev.filter((x) => x !== lastHiddenId));
    if (user?.id) removeHiddenPlan(user.id, lastHiddenId);
    setLastHiddenId(null);
  }

  const onPressDiscoverLocation = useCallback(() => {
    if (canTravelMode) {
      router.push('/settings/travel' as Href);
      return;
    }
    setUpgradeFeature('discover.travel_mode');
    setUpgradeTier('GOLD');
    setUpgradeOpen(true);
  }, [canTravelMode]);

  const onGoPremiumFromTravelPaywall = useCallback(() => {
    setTravelPaywallOpen(false);
    router.push('/subscription' as Href);
  }, []);

  useEffect(() => {
    if (!user?.id || !dbUser) return;

    void (async () => {
      const queue: FirstSessionModal[] = [];

      if (dbUser.silver_trial_activated_at && hasActiveSilverTrial(dbUser)) {
        const seen = await AsyncStorage.getItem(`silver_trial_welcome_seen_${user.id}`);
        if (!seen) queue.push('silverWelcome');
      }

      if (hasActiveGoldTrial(dbUser)) {
        const seen = await AsyncStorage.getItem(`gold_trial_welcome_seen_${user.id}`);
        if (!seen) queue.push('goldWelcome');
      }

      if (!isUserVerified(dbUser.verification_status)) {
        const pending = await peekSoftKycPromptPending();
        if (pending) queue.push('softKyc');
      }

      modalQueueRef.current = queue;
      setActiveModal(queue[0] ?? null);
    })();
  }, [
    user?.id,
    dbUser?.id,
    dbUser?.verification_status,
    dbUser?.silver_trial_activated_at,
    dbUser?.silver_trial_expires_at,
    dbUser?.gold_trial_expires_at,
  ]);

  useEffect(() => {
    if (activeModal === 'softKyc') {
      void consumeSoftKycPromptPending();
    }
    if (activeModal === 'goldWelcome' && user?.id) {
      void AsyncStorage.setItem(`gold_trial_welcome_seen_${user.id}`, '1');
    }
  }, [activeModal, user?.id]);

  useEffect(() => {
    setSilverWelcomeOpen(activeModal === 'silverWelcome');
    setGoldWelcomeOpen(activeModal === 'goldWelcome');
    setSoftKycOpen(activeModal === 'softKyc');
  }, [activeModal]);

  const advanceModalQueue = useCallback(() => {
    modalQueueRef.current = modalQueueRef.current.slice(1);
    setActiveModal(modalQueueRef.current[0] ?? null);
  }, []);

  const feedBanner = useMemo(
    () => (
      <>
        <TrialBanner
          dbUser={dbUser}
          dismissed={trialBannerDismissed}
          onDismiss={() => setTrialBannerDismissed(true)}
          onUpgrade={() => router.push('/subscription' as Href)}
        />
        {unverified ? <PlansKycBanner visible /> : null}
        {showLocPrompt ? (
          <PlansLocationPrompt
            onAllow={onAllowLocation}
            onNotNow={() => {
              setLocPromptDismissed(true);
              void AsyncStorage.setItem(LOCATION_PROMPT_DISMISSED_KEY, 'true');
            }}
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
        <MoodTimelineCarousel
          rows={moodTimelineRows}
          onOpenPlan={openPlanFromFeed}
          currentUserId={user?.id}
        />
      </>
    ),
    [unverified, showLocPrompt, error, onAllowLocation, retryLoad, moodTimelineRows, openPlanFromFeed, dbUser, trialBannerDismissed]
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
      if (canDismissSwipe) {
        setHiddenPlanIds((prev) => [...prev, row.id]);
        setLastHiddenId(row.id);
        if (user?.id) persistHiddenPlan(user.id, row.id);
      }
    },
    [canDismissSwipe, user?.id]
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
        subscriber={canDismissSwipe}
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
      canDismissSwipe,
      openPlanFromFeed,
      onPressOffer,
      dismissRow,
    ]
  );

  const showSwipe = feedMode === 'swipe' && !error;

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
          isPremium={canAdvancedFilters}
          initial={feedFilter}
          discoveryMood={discoveryMood}
          feedMode={feedMode}
          baseRadiusKm={radiusKm}
          browseRadiusKm={browseRadiusKm}
          hasWiderRadius={hasWiderRadius}
          effectiveTier={discoverTier}
          onUpgrade={() => {
            setFilterOpen(false);
            router.push('/subscription' as Href);
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
        message="Upgrade to Gold to browse meetups as if you were in another city. Your home base stays saved — turn travel mode off anytime."
      />
      <NearbyPlansHeader
        locationLabel={headerLocationLabel}
        onPressLocation={onPressDiscoverLocation}
        onPressFilter={() => setFilterOpen(true)}
        showUndo={canUndoSwipe && !!lastHiddenId}
        onUndoLastHide={undoHide}
        isIncognitoActive={isIncognitoActive}
      />
      <UpgradePrompt
        visible={upgradeOpen}
        feature={upgradeFeature}
        requiredTier={upgradeTier}
        onUpgrade={() => {
          setUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />
      <SilverTrialWelcomeModal
        visible={silverWelcomeOpen}
        onContinue={() => {
          if (user?.id) {
            void AsyncStorage.setItem(`silver_trial_welcome_seen_${user.id}`, '1');
          }
          advanceModalQueue();
        }}
      />
      <GoldTrialWelcomeModal
        visible={goldWelcomeOpen}
        onContinue={advanceModalQueue}
      />
      <SoftKycPrompt visible={softKycOpen} onDismiss={advanceModalQueue} />
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
            <View style={styles.swipeStage}>
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
                  layoutMode="fill"
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
            </View>
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
            ? swipeFabBottomOffset(tabBarInset)
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
  swipeStage: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end',
  },
  swipeDeckZone: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end',
  },
  swipeActionsZone: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
