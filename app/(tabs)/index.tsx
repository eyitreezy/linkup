/**
 * Discovery feed — swipe-first meetup ideas + list mode; filters live in the filter sheet.
 */
import { DiscoverInlineEmpty } from '@/components/discovery/DiscoverInlineEmpty';
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
import { PrivacyReconsentBanner } from '@/components/PrivacyReconsentBanner';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { PremiumFeaturePaywallModal } from '@/components/premium/PremiumFeaturePaywallModal';
import { PlansSearchBar } from '@/components/plans/PlansSearchBar';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseStoredFeedFilters } from '@/lib/discovery/parseStoredFeedFilters';
import {
  discoverPriceFilterForQuery,
  hasDiscoverPriceFilter,
  planPassesDiscoverPriceFilter,
} from '@/lib/discovery/discoverPriceFilter';
import { swipeFabBottomOffset } from '@/lib/discovery/swipeLayout';
import { peekDiscoverFeedSession, writeDiscoverFeedSession } from '@/lib/discovery/discoverFeedSessionCache';
import { consumePendingMeetTypeFilter } from '@/lib/discovery/pendingMeetTypeFilter';
import { warmPublicProfileNavigation } from '@/lib/profile/publicProfileSeed';
import { subscribeDiscoverPlansRealtime } from '@/lib/discovery/subscribeDiscoverPlansRealtime';
import { subscribeDiscoverOffersRealtime } from '@/lib/discovery/subscribeDiscoverOffersRealtime';
import { subscribeDiscoverHiddenPlansRealtime } from '@/lib/discovery/subscribeDiscoverHiddenPlansRealtime';
import { subscribeDiscoverPresenceRealtime } from '@/lib/discovery/subscribeDiscoverPresenceRealtime';
import { filterPlansByMood, type DiscoveryMood } from '@/lib/discovery/moodFilter';
import { distanceKm, loadCachedViewerCoords, normalizeViewerCoordinate, resolveDiscoverViewerLocation, resolveDiscoverViewerOrigin, saveCachedViewerCoords, viewerDiscoverOriginReady } from '@/lib/location';
import { fetchLatestBidderOffersByPlanIds } from '@/lib/plans/fetchLatestBidderOffersByPlans';
import {
  fetchPlansPage,
  fetchProfilesForCreators,
  fetchIntroVideosForCreators,
  filterPremiumVisibilityPlans,
  filterRadiusVisibilityPlans,
  mergePlansWithProfiles,
  type PlanRowFromDb,
} from '@/lib/plans/planFeedMerge';
import { clampMaxDistanceKm } from '@/lib/plans/discoveryRadius';
import {
  filterDiscoverRowsByDistance,
  isDistanceFilterActive,
  planWithinMaxDistanceKm,
  resolveDiscoverMaxDistanceKm,
  sortDiscoverByDistanceAsc,
} from '@/lib/plans/discoverDistanceFilter';
import { rankDiscoveryPlans, rankMoodTimelinePlans } from '@/lib/plans/feedRanking';
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
import { hasActiveGoldTrial, hasActiveSilverTrial, resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { peekSoftKycPromptPending, consumeSoftKycPromptPending } from '@/lib/verification/softPromptStorage';
import type { SubscriptionTier } from '@/types/database';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isUserVerified, requiresVerificationGate } from '@/lib/verification/access';
import type { DbPlanOffer, DbProfile, DbUserPresence } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import * as Location from 'expo-location';
import { DEFAULT_TAB_BAR_INSET, useTabBarVisibilityOptional } from '@/contexts/TabBarVisibilityContext';
import { useShowTabBarOnFocus, useTabBarScrollProps } from '@/hooks/useTabBarScrollHandler';
import { useFocusEffect } from '@react-navigation/native';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type ListRenderItemInfo,
  Platform,
  Pressable,
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
  viewerHasLocation: boolean;
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
  viewerHasLocation,
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
    warmPublicProfileNavigation(row.creator_id, row.creatorProfile ?? undefined);
    router.push(`/user/${row.creator_id}` as Href);
  }, [row.creator_id, row.creatorProfile]);
  const onPressOffer = useCallback(() => onOfferRow(row), [row, onOfferRow]);
  const onDismiss = useCallback(() => onDismissRow(row.id), [row.id, onDismissRow]);
  return (
    <PlanCard
      row={row}
      distanceKm={dist}
      viewerHasLocation={viewerHasLocation}
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
  const tabBarVisibility = useTabBarVisibilityOptional();
  const tabBarInset = tabBarVisibility?.tabBarInset ?? DEFAULT_TAB_BAR_INSET;
  const { user, profile, dbUser, refreshProfile } = useAuth();
  const initialDiscoverSession = user?.id ? peekDiscoverFeedSession(user.id) : null;
  const [rows, setRows] = useState<PlanFeedRow[]>(() => initialDiscoverSession?.rows ?? []);
  const [perm, setPerm] = useState<Location.PermissionStatus | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cityLabel, setCityLabel] = useState('Near you');
  const [locPromptDismissed, setLocPromptDismissed] = useState(false);
  const [locPromptBusy, setLocPromptBusy] = useState(false);
  const locPromptBusyRef = useRef(false);
  const autoLocateInFlightRef = useRef(false);

  const [feedHydrating, setFeedHydrating] = useState(
    () =>
      !initialDiscoverSession ||
      (initialDiscoverSession.rows.length === 0 && initialDiscoverSession.acc.length === 0)
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialDiscoverSession?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateTitle, setGateTitle] = useState<string | undefined>();
  const [gateMessage, setGateMessage] = useState<string | undefined>();

  const pageRef = useRef(initialDiscoverSession?.page ?? 0);
  const accRef = useRef<PlanRowFromDb[]>(initialDiscoverSession?.acc ?? []);
  const sessionHydratedForUserRef = useRef<string | null>(user?.id ?? null);
  const distancePrefetchPagesRef = useRef(0);
  const feedFiltersHydratedRef = useRef(false);

  const radiusKm = profile?.radius_km ? Number(profile.radius_km) : 50;
  const { allowed: canAdvancedFilters } = usePermission('discover.advanced_filters');
  const { allowed: canTravelMode } = usePermission('discover.travel_mode');
  const { allowed: canUndoSwipe } = usePermission('discover.undo_swipe');
  const canDismissSwipe = canUndoSwipe;
  const travel = profile?.preferences?.travel_mode ?? null;
  const { lat: effectiveLat, lng: effectiveLng } = useMemo(
    () =>
      resolveDiscoverViewerOrigin({
        deviceLat: coords?.lat,
        deviceLng: coords?.lng,
        profileLat: profile?.latitude,
        profileLng: profile?.longitude,
        canTravelMode,
        travelLat: travel?.latitude,
        travelLng: travel?.longitude,
        travelLabel: travel?.label,
      }),
    [
      coords?.lat,
      coords?.lng,
      profile?.latitude,
      profile?.longitude,
      canTravelMode,
      travel?.latitude,
      travel?.longitude,
      travel?.label,
    ]
  );
  const headerLocationLabel =
    canTravelMode && travel?.label ? `${travel.label} · Travel` : cityLabel;

  const [feedFilter, setFeedFilter] = useState<FeedFilterState>({
    maxDistanceKm: null,
    minPriceCents: null,
    maxPriceCents: null,
    verifiedHostsOnly: false,
    hostPresence: 'all',
    clientFiltersActive: false,
    distanceFilterActive: false,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [travelPaywallOpen, setTravelPaywallOpen] = useState(false);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const [needsPrivacyReconsent, setNeedsPrivacyReconsent] = useState(false);
  const [reconsentBannerDismissed, setReconsentBannerDismissed] = useState(false);
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
  const visibleCreatorIdsRef = useRef<Set<string>>(new Set());

  const [feedMode, setFeedMode] = useState<FeedViewMode>('swipe');
  const [discoveryMood, setDiscoveryMood] = useState<DiscoveryMood>('all');
  const [meetTypeFilter, setMeetTypeFilter] = useState<{ id: string; name: string } | null>(null);
  /** Plans already swiped off the deck this session — instant removal, one action per card. */
  const [deckDismissedPlanIds, setDeckDismissedPlanIds] = useState<Set<string>>(() => new Set());
  const swipeDeckRef = useRef<PlansSwipeDeckRef>(null);

  const unverified = !!(dbUser && !isUserVerified(dbUser.verification_status));
  const viewerTier = resolveClientEffectiveTier(dbUser);
  const isIncognitoActive =
    viewerTier === 'PLATINUM' && !!profile?.incognito_browse_enabled;

  useEffect(() => {
    void AsyncStorage.getItem(LOCATION_PROMPT_DISMISSED_KEY).then((v) => {
      if (v === 'true') setLocPromptDismissed(true);
    });
  }, []);

  useEffect(() => {
    if (coords) return;
    void (async () => {
      const cached = await loadCachedViewerCoords();
      if (cached) {
        setCoords(cached);
        return;
      }
      const lat = normalizeViewerCoordinate(profile?.latitude);
      const lng = normalizeViewerCoordinate(profile?.longitude);
      if (lat != null && lng != null) {
        setCoords({ lat, lng });
        const label = profile?.location_label?.trim();
        if (label) setCityLabel(label);
      }
    })();
  }, [coords, profile?.latitude, profile?.longitude, profile?.location_label]);

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

  const persistFeedMode = useCallback(
    (mode: FeedViewMode) => {
      setFeedMode(mode);
      void AsyncStorage.setItem(FEED_MODE_STORAGE_KEY, mode);
      if (mode === 'swipe') {
        tabBarVisibility?.showTabBar();
      }
    },
    [tabBarVisibility]
  );

  useEffect(() => {
    if (feedMode === 'swipe') {
      tabBarVisibility?.showTabBar();
    }
  }, [feedMode, tabBarVisibility]);

  const onDebouncedSearchChange = useCallback((q: string) => {
    setDebouncedSearchQuery(q);
  }, []);

  useEffect(() => {
    if (feedFiltersHydratedRef.current || !profile?.preferences) return;
    const f = profile.preferences.feed_filters;
    if (f && typeof f === 'object') {
      const parsed = parseStoredFeedFilters(f, radiusKm);
      if (parsed.clientFiltersActive || parsed.distanceFilterActive) {
        setFeedFilter({
          ...parsed,
          maxDistanceKm:
            parsed.maxDistanceKm != null
              ? clampMaxDistanceKm(parsed.maxDistanceKm, viewerTier)
              : null,
        });
      }
    }
    feedFiltersHydratedRef.current = true;
  }, [profile?.preferences, radiusKm, viewerTier]);

  const distanceFilterActive = isDistanceFilterActive(feedFilter);

  const discoverQueryPriceFilter = useMemo(
    () => discoverPriceFilterForQuery(feedFilter),
    [feedFilter.clientFiltersActive, feedFilter.minPriceCents, feedFilter.maxPriceCents]
  );

  const discoverPriceFilterKey = useMemo(
    () =>
      `${discoverQueryPriceFilter?.minPriceCents ?? ''}:${discoverQueryPriceFilter?.maxPriceCents ?? ''}`,
    [discoverQueryPriceFilter]
  );

  const fetchDiscoverPage = useCallback(
    async (from: number, to: number) => {
      return fetchPlansPage(from, to, user?.id ?? null, discoverQueryPriceFilter);
    },
    [user?.id, discoverQueryPriceFilter]
  );

  const fetchDiscoverPageRef = useRef(fetchDiscoverPage);
  fetchDiscoverPageRef.current = fetchDiscoverPage;

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
    const [profMap, videoMap] = await Promise.all([
      fetchProfilesForCreators(ids),
      fetchIntroVideosForCreators(ids),
    ]);
    let merged = mergePlansWithProfiles(accRef.current, profMap, videoMap);
    const blocked = new Set(blockedIds);
    const hidden = new Set(hiddenPlanIds);
    const maxKm = resolveDiscoverMaxDistanceKm(feedFilter, radiusKm, distanceFilterActive);

    merged = merged.filter((row) => {
      if (row.is_mood_plan && isPlanMoodWindowClosed(row)) return false;
      if (row.is_suppressed) return false;
      if (row.archived_at != null) return false;
      if (hidden.has(row.id)) return false;
      if (blocked.has(row.creator_id)) return false;
      if (row.is_group_plan) {
        const accepted = row.accepted_guest_count ?? 0;
        const max = row.max_guests;
        if (max != null && accepted >= max) return false;
      }
      if (user?.id && row.creator_id === user.id && !distanceFilterActive) return true;
      if (
        distanceFilterActive &&
        !planWithinMaxDistanceKm(
          row,
          user?.id ?? null,
          effectiveLat,
          effectiveLng,
          maxKm,
          true,
          false
        )
      ) {
        return false;
      }
      if (
        row.is_mood_plan &&
        !moodReachVisibleToViewer(row, user?.id ?? null, effectiveLat, effectiveLng)
      ) {
        return false;
      }
      if (feedFilter.clientFiltersActive) {
        if (feedFilter.verifiedHostsOnly && !row.creatorProfile?.verified_badge) return false;
        if (
          hasDiscoverPriceFilter(feedFilter) &&
          !planPassesDiscoverPriceFilter(row, feedFilter)
        ) {
          return false;
        }
      }
      return true;
    });

    merged = filterPremiumVisibilityPlans(
      merged,
      viewerTier,
      user?.id ?? null,
      effectiveLat,
      effectiveLng
    );
    merged = filterRadiusVisibilityPlans(merged, user?.id ?? null, effectiveLat, effectiveLng);

    merged = rankDiscoveryPlans(merged, {
      effectiveLat,
      effectiveLng,
      sortDistanceAscending: effectiveLat != null && effectiveLng != null,
    });
    setRows(merged);
    writeDiscoverFeedSession(user?.id, {
      rows: merged,
      acc: accRef.current,
      page: pageRef.current,
    });
  }, [
    user?.id,
    radiusKm,
    effectiveLat,
    effectiveLng,
    feedFilter,
    distanceFilterActive,
    hiddenPlanIds,
    blockedIds,
    viewerTier,
  ]);

  const removePlanFromFeed = useCallback((planId: string) => {
    accRef.current = accRef.current.filter((p) => p.id !== planId);
    void rebuildRowsRef.current();
  }, []);

  const rebuildRowsRef = useRef(rebuildRows);
  rebuildRowsRef.current = rebuildRows;

  const silentRefreshDiscoverHead = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { plans: headPlans, error: fetchErr } = await fetchDiscoverPageRef.current(0, PAGE_SIZE - 1);
    if (fetchErr) return;
    const headIds = new Set(headPlans.map((p) => p.id));
    const rest = accRef.current.filter((p) => !headIds.has(p.id));
    accRef.current = dedupePlans(headPlans, rest);
    await rebuildRowsRef.current();
  }, []);

  const silentRefreshDiscoverHeadRef = useRef(silentRefreshDiscoverHead);
  silentRefreshDiscoverHeadRef.current = silentRefreshDiscoverHead;

  const removePlanFromFeedRef = useRef(removePlanFromFeed);
  removePlanFromFeedRef.current = removePlanFromFeed;

  const refreshVisibleOffersRef = useRef<() => void>(() => {});

  useEffect(() => {
    void rebuildRows();
  }, [rebuildRows]);

  const rowIdsKey = useMemo(() => rows.map((r) => r.id).join('|'), [rows]);

  const refreshVisibleOffers = useCallback(() => {
    if (!user?.id || rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    void fetchLatestBidderOffersByPlanIds(user.id, ids)
      .then(setBidderOffersByPlan)
      .catch(() => {});
  }, [user?.id, rows]);

  refreshVisibleOffersRef.current = refreshVisibleOffers;

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
    visibleCreatorIdsRef.current = new Set(
      presenceCreatorKey ? presenceCreatorKey.split('|').filter(Boolean) : []
    );
  }, [presenceCreatorKey]);

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
    const maxKm = resolveDiscoverMaxDistanceKm(feedFilter, radiusKm, distanceFilterActive);
    let distanceFiltered = filterDiscoverRowsByDistance(
      rows,
      distanceFilterActive,
      maxKm,
      user?.id ?? null,
      effectiveLat,
      effectiveLng
    );
    if (distanceFilterActive && effectiveLat != null && effectiveLng != null) {
      distanceFiltered = sortDiscoverByDistanceAsc(distanceFiltered, effectiveLat, effectiveLng);
    }
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return distanceFiltered;
    return distanceFiltered.filter((r) => {
      const t = (r.title ?? '').toLowerCase();
      const d = (r.description ?? '').toLowerCase();
      const c = (r.category ?? '').toLowerCase();
      return t.includes(q) || d.includes(q) || c.includes(q);
    });
  }, [
    rows,
    debouncedSearchQuery,
    feedFilter,
    distanceFilterActive,
    radiusKm,
    user?.id,
    effectiveLat,
    effectiveLng,
  ]);

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingMeetTypeFilter();
      if (pending) setMeetTypeFilter(pending);
    }, [])
  );

  const moodFilteredRows = useMemo(
    () => filterPlansByMood(filteredRows, discoveryMood),
    [filteredRows, discoveryMood]
  );

  const presenceFilteredRows = useMemo(() => {
    let next = moodFilteredRows;
    if (feedFilter.hostPresence !== 'all') {
      next = next.filter((row) => {
        if (user?.id && row.creator_id === user.id) return true;
        const kind = resolveHostPresenceKind(
          profile ?? null,
          row.creatorProfile?.preferences,
          presenceByUser[row.creator_id] ?? null,
          !!row.creatorProfile?.masked_activity_enabled
        );
        return hostPresenceMatchesFilter(kind, feedFilter.hostPresence);
      });
    }
    if (meetTypeFilter?.id) {
      next = next.filter((row) => row.meet_type_id === meetTypeFilter.id);
    }
    return next;
  }, [
    moodFilteredRows,
    feedFilter.hostPresence,
    presenceByUser,
    profile,
    user?.id,
    meetTypeFilter?.id,
  ]);

  const moodTimelineRows = useMemo(() => {
    const live = presenceFilteredRows.filter((r) => r.is_mood_plan && !isPlanMoodWindowClosed(r));
    return rankMoodTimelinePlans(live, { effectiveLat, effectiveLng });
  }, [presenceFilteredRows, effectiveLat, effectiveLng]);

  const standardDiscoverRows = useMemo(
    () => presenceFilteredRows.filter((r) => !r.is_mood_plan),
    [presenceFilteredRows]
  );

  const swipeDeckRows = useMemo(
    () => standardDiscoverRows.filter((row) => !deckDismissedPlanIds.has(row.id)),
    [standardDiscoverRows, deckDismissedPlanIds]
  );

  const dismissFromSwipeDeck = useCallback((planId: string) => {
    setDeckDismissedPlanIds((prev) => {
      if (prev.has(planId)) return prev;
      const next = new Set(prev);
      next.add(planId);
      return next;
    });
  }, []);

  const resetSwipeDeck = useCallback(() => {
    setDeckDismissedPlanIds(new Set());
  }, []);

  const applyViewerLocation = useCallback((lat: number, lng: number, label: string) => {
    if (__DEV__) {
      console.info('[Discover] viewer location active', { lat, lng, label });
    }
    setCoords({ lat, lng });
    setCityLabel(label);
    void saveCachedViewerCoords(lat, lng);
  }, []);

  const persistViewerLocation = useCallback(
    async (lat: number, lng: number, label: string): Promise<boolean> => {
      if (!user?.id || !isSupabaseConfigured) return false;
      const patch: { latitude: number; longitude: number; location_label?: string } = {
        latitude: lat,
        longitude: lng,
      };
      if (label !== 'Near you') patch.location_label = label;
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', user.id)
        .select('latitude, longitude')
        .maybeSingle();
      if (error) {
        if (__DEV__) {
          console.warn('[Discover] failed to save profile location', error.message);
        }
        return false;
      }
      if (data?.latitude == null || data?.longitude == null) {
        if (__DEV__) {
          console.warn('[Discover] profile location update returned no coordinates');
        }
        return false;
      }
      await refreshProfile();
      return true;
    },
    [user?.id, refreshProfile]
  );

  const autoLocateViewer = useCallback(
    async (requestPermission: boolean) => {
      if (viewerDiscoverOriginReady(effectiveLat, effectiveLng)) return;
      if (autoLocateInFlightRef.current) return;

      autoLocateInFlightRef.current = true;
      try {
        const result = await resolveDiscoverViewerLocation({
          profileLat: profile?.latitude,
          profileLng: profile?.longitude,
          profileLabel: profile?.location_label,
          requestPermission,
        });

        setPerm(result.permission);

        if (!result.ok) {
          return;
        }

        setLocPromptDismissed(false);
        void AsyncStorage.removeItem(LOCATION_PROMPT_DISMISSED_KEY);
        applyViewerLocation(result.location.lat, result.location.lng, result.location.label);

        if (result.location.source !== 'profile') {
          void persistViewerLocation(
            result.location.lat,
            result.location.lng,
            result.location.label
          );
        }

        void rebuildRowsRef.current();
      } finally {
        autoLocateInFlightRef.current = false;
      }
    },
    [
      applyViewerLocation,
      effectiveLat,
      effectiveLng,
      persistViewerLocation,
      profile?.latitude,
      profile?.longitude,
      profile?.location_label,
    ]
  );

  useEffect(() => {
    if (!user?.id) return;
    void autoLocateViewer(true);
  }, [user?.id, autoLocateViewer]);

  useEffect(() => {
    if (!user?.id) return;
    if (sessionHydratedForUserRef.current === user.id) return;
    sessionHydratedForUserRef.current = user.id;
    const cached = peekDiscoverFeedSession(user.id);
    if (cached.acc.length === 0 && cached.rows.length === 0) return;
    accRef.current = cached.acc;
    pageRef.current = cached.page;
    setHasMore(cached.hasMore);
    setRows(cached.rows);
    setFeedHydrating(false);
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user?.id || !isSupabaseConfigured) {
        if (!cancelled && !isSupabaseConfigured) {
          setError('App is not connected.');
          setFeedHydrating(false);
        }
        return;
      }
      const hasCachedRows = accRef.current.length > 0;
      if (hasCachedRows) {
        setFeedHydrating(false);
        await silentRefreshDiscoverHeadRef.current();
        if (cancelled) return;
        writeDiscoverFeedSession(user?.id, {
          page: pageRef.current,
        });
        return;
      }
      setFeedHydrating(true);
      const { plans: newPlans, error: fetchErr } = await fetchDiscoverPage(0, PAGE_SIZE - 1);
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr);
        setFeedHydrating(false);
        return;
      }
      accRef.current = dedupePlans([], newPlans);
      pageRef.current = 1;
      setHasMore(newPlans.length === PAGE_SIZE);
      setError(null);
      await rebuildRowsRef.current();
      if (!cancelled) {
        setFeedHydrating(false);
        writeDiscoverFeedSession(user?.id, {
          hasMore: newPlans.length === PAGE_SIZE,
          page: pageRef.current,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchDiscoverPage, isSupabaseConfigured]);

  const onRefresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setDeckDismissedPlanIds(new Set());
    setRefreshing(true);
    setError(null);
    pageRef.current = 0;
    accRef.current = [];
    setHasMore(true);
    const { plans: newPlans, error: fetchErr } = await fetchDiscoverPage(0, PAGE_SIZE - 1);
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
  }, [user?.id, fetchDiscoverPage]);

  const firstDiscoverFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const fg = await Location.getForegroundPermissionsAsync();
        setPerm(fg.status);
        if (!viewerDiscoverOriginReady(effectiveLat, effectiveLng)) {
          await autoLocateViewer(fg.status !== 'granted');
        }
      })();

      if (!isSupabaseConfigured) return;
      if (firstDiscoverFocusRef.current) {
        firstDiscoverFocusRef.current = false;
        return;
      }
      void onRefresh();
    }, [autoLocateViewer, effectiveLat, effectiveLng, isSupabaseConfigured, onRefresh])
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const unsubPlans = subscribeDiscoverPlansRealtime({
      userId: user?.id,
      onRemovePlan: (planId) => removePlanFromFeedRef.current(planId),
      onRefreshPlans: () => {
        void silentRefreshDiscoverHeadRef.current();
      },
    });

    const unsubOffers = user?.id
      ? subscribeDiscoverOffersRealtime({
          userId: user.id,
          onRefreshOffers: () => refreshVisibleOffersRef.current(),
        })
      : () => {};

    const unsubHidden = user?.id
      ? subscribeDiscoverHiddenPlansRealtime({
          userId: user.id,
          onHiddenPlan: (planId) => {
            setHiddenPlanIds((prev) => (prev.includes(planId) ? prev : [...prev, planId]));
            removePlanFromFeedRef.current(planId);
          },
        })
      : () => {};

    const unsubPresence = subscribeDiscoverPresenceRealtime({
      isTrackedCreator: (creatorId) => visibleCreatorIdsRef.current.has(creatorId),
      onPresenceChange: (row) => {
        setPresenceByUser((prev) => ({ ...prev, [row.user_id]: row }));
      },
    });

    return () => {
      unsubPlans();
      unsubOffers();
      unsubHidden();
      unsubPresence();
    };
  }, [user?.id]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || feedHydrating || error || !isSupabaseConfigured) return;
    setLoadingMore(true);
    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { plans: newPlans, error: fetchErr } = await fetchDiscoverPage(from, to);
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
  }, [error, fetchDiscoverPage, hasMore, feedHydrating, loadingMore]);

  function openCreateGate() {
    setGateTitle('Quick verification');
    setGateMessage('So people feel safe meeting in person. It only takes a minute.');
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
      seedPlanDetailFromFeed(row);
      router.push(`/plan/${row.id}/negotiate` as Href);
    },
    [dbUser?.verification_status, openOfferGate]
  );

  const dismissLocationPrompt = useCallback((persist = true) => {
    setLocPromptDismissed(true);
    if (persist) {
      void AsyncStorage.setItem(LOCATION_PROMPT_DISMISSED_KEY, 'true');
    }
  }, []);

  const onNotNowLocation = useCallback(() => {
    dismissLocationPrompt(true);
  }, [dismissLocationPrompt]);

  const onAllowLocation = useCallback(async () => {
    if (locPromptBusyRef.current) return;
    locPromptBusyRef.current = true;
    setLocPromptBusy(true);

    const releaseBusy = () => {
      locPromptBusyRef.current = false;
      setLocPromptBusy(false);
    };

    const safetyTimer = setTimeout(releaseBusy, 20_000);

    try {
      await autoLocateViewer(true);
    } finally {
      clearTimeout(safetyTimer);
      releaseBusy();
    }
  }, [autoLocateViewer]);

  const retryLoad = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setError(null);
    setFeedHydrating(true);
    pageRef.current = 0;
    accRef.current = [];
    const { plans: newPlans, error: fetchErr } = await fetchDiscoverPage(0, PAGE_SIZE - 1);
    if (fetchErr) {
      setError(fetchErr);
      setFeedHydrating(false);
      return;
    }
    accRef.current = dedupePlans([], newPlans);
    pageRef.current = 1;
    setHasMore(newPlans.length === PAGE_SIZE);
    await rebuildRowsRef.current();
    setFeedHydrating(false);
  }, [user?.id, fetchDiscoverPage]);

  const viewerLocated = viewerDiscoverOriginReady(effectiveLat, effectiveLng);
  /** Only when the user denied OS permission — auto-locate runs silently otherwise. */
  const showLocPrompt = !viewerLocated && perm === 'denied' && !locPromptDismissed;

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
    if (!dbUser?.id) return;
    void (async () => {
      const { data, error } = await supabase.rpc('user_needs_privacy_reconsent', {
        p_user_id: dbUser.id,
      });
      if (error) {
        if (__DEV__) console.warn('[privacy] reconsent check:', error.message);
        return;
      }
      setNeedsPrivacyReconsent(!!data);
    })();
  }, [dbUser?.id]);

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
        {needsPrivacyReconsent && !reconsentBannerDismissed ? (
          <PrivacyReconsentBanner
            onReview={() => router.push('/legal/privacy-reconsent' as Href)}
            onDismiss={() => setReconsentBannerDismissed(true)}
          />
        ) : null}
        {unverified ? <PlansKycBanner visible /> : null}
        {showLocPrompt ? (
          <PlansLocationPrompt
            onAllow={() => void onAllowLocation()}
            onNotNow={onNotNowLocation}
            allowBusy={locPromptBusy}
            permissionGranted={false}
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
        {meetTypeFilter ? (
          <Pressable
            style={styles.meetTypeFilterPill}
            onPress={() => setMeetTypeFilter(null)}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${meetTypeFilter.name} filter`}
          >
            <Ionicons name="compass" size={14} color={colors.primary} />
            <Text style={styles.meetTypeFilterTxt}>{meetTypeFilter.name}</Text>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <MoodTimelineCarousel
          rows={moodTimelineRows}
          onOpenPlan={openPlanFromFeed}
          currentUserId={user?.id}
        />
      </>
    ),
    [unverified, showLocPrompt, error, onAllowLocation, onNotNowLocation, locPromptBusy, retryLoad, moodTimelineRows, openPlanFromFeed, dbUser, trialBannerDismissed, meetTypeFilter, needsPrivacyReconsent, reconsentBannerDismissed]
  );

  const searchActive = debouncedSearchQuery.trim().length > 0;

  useEffect(() => {
    if (feedMode === 'swipe') setDebouncedSearchQuery('');
  }, [feedMode]);

  useEffect(() => {
    resetSwipeDeck();
  }, [debouncedSearchQuery, discoveryMood, meetTypeFilter?.id, resetSwipeDeck]);

  const onSwipeInterested = useCallback(
    (row: PlanFeedRow) => {
      dismissFromSwipeDeck(row.id);
      if (requiresVerificationGate(dbUser?.verification_status)) {
        openOfferGate();
        return;
      }
      seedPlanDetailFromFeed(row);
      router.push(`/plan/${row.id}/negotiate` as Href);
    },
    [dbUser?.verification_status, dismissFromSwipeDeck, openOfferGate]
  );

  const onSwipePass = useCallback(
    (row: PlanFeedRow) => {
      dismissFromSwipeDeck(row.id);
      setHiddenPlanIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
      setLastHiddenId(row.id);
      if (canDismissSwipe && user?.id) {
        persistHiddenPlan(user.id, row.id);
      }
    },
    [canDismissSwipe, dismissFromSwipeDeck, user?.id]
  );

  const listEmpty =
    feedHydrating ? (
      <PlansFeedSkeleton />
    ) : error ? null : filteredRows.length > 0 && moodFilteredRows.length === 0 ? (
      <DiscoverInlineEmpty
        icon="color-palette-outline"
        title="Nothing in this vibe"
        titleAccent="yet"
        subtitle="Try another mood or switch back to All to see more meetups."
      />
    ) : searchActive && standardDiscoverRows.length === 0 ? (
      <DiscoverInlineEmpty
        icon="search-outline"
        title="No matches for that search"
        subtitle="Try a looser keyword or clear search. The best plans are often one word away."
      />
    ) : standardDiscoverRows.length === 0 && moodTimelineRows.length > 0 ? (
      <DiscoverInlineEmpty
        icon="flash-outline"
        title="Mood moments in the timeline"
        subtitle="Swipe the timeline for sparks on a countdown. Longer meetups land in the deck when they appear."
      />
    ) : (feedFilter.clientFiltersActive || distanceFilterActive) &&
      !searchActive &&
      standardDiscoverRows.length === 0 &&
      moodTimelineRows.length === 0 ? (
      <DiscoverInlineEmpty
        icon="options-outline"
        title="Nothing matches right now"
        subtitle={
          hasDiscoverPriceFilter(feedFilter)
            ? 'No plans fall in this price range. Widen your min/max price or clear filters to see more meetups.'
            : 'Widen your radius, clear filters, or switch mood to see more meetups.'
        }
        ctaLabel="Open filters"
        onCtaPress={() => setFilterOpen(true)}
      />
    ) : (
      <PlansEmptyState onCreatePress={goCreatePlan} />
    );

  const discoverFeedEmpty =
    !feedHydrating && !error && standardDiscoverRows.length === 0;

  const distanceForRow = useCallback(
    (row: PlanFeedRow): number | null => {
      const planLat = normalizeViewerCoordinate(row.latitude);
      const planLng = normalizeViewerCoordinate(row.longitude);
      if (
        planLat == null ||
        planLng == null ||
        effectiveLat == null ||
        effectiveLng == null
      ) {
        return null;
      }
      return distanceKm(effectiveLat, effectiveLng, planLat, planLng);
    },
    [effectiveLat, effectiveLng]
  );

  const viewerHasLocation = viewerDiscoverOriginReady(effectiveLat, effectiveLng);
  const viewerLocationKey = viewerHasLocation ? `${effectiveLat},${effectiveLng}` : 'none';

  const discoverListKeyExtractor = useCallback((item: PlanFeedRow) => item.id, []);

  const renderDiscoverListItem = useCallback(
    ({ item }: ListRenderItemInfo<PlanFeedRow>) => (
      <DiscoverPlanListRow
        row={item}
        distanceKm={distanceForRow(item)}
        viewerHasLocation={viewerHasLocation}
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
      viewerHasLocation,
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
    if (!showSwipe || !hasMore || loadingMore || feedHydrating || error) return;
    const remaining = swipeDeckRows.length;
    if (remaining <= 3) void onEndReached();
  }, [
    showSwipe,
    swipeDeckRows.length,
    hasMore,
    loadingMore,
    feedHydrating,
    error,
    onEndReached,
  ]);

  /** When distance filter is on, prefetch more pages until the feed has enough nearby plans. */
  useEffect(() => {
    if (!distanceFilterActive) {
      distancePrefetchPagesRef.current = 0;
      return;
    }
    if (!hasMore || loadingMore || feedHydrating || error) return;
    if (presenceFilteredRows.length >= 10) {
      distancePrefetchPagesRef.current = 0;
      return;
    }
    if (distancePrefetchPagesRef.current >= 5) return;
    distancePrefetchPagesRef.current += 1;
    void onEndReached();
  }, [
    distanceFilterActive,
    presenceFilteredRows.length,
    hasMore,
    loadingMore,
    feedHydrating,
    error,
    onEndReached,
  ]);

  useEffect(() => {
    if (!showSwipe || swipeDeckRows.length === 0) return;
    for (let i = 0; i < Math.min(3, swipeDeckRows.length); i += 1) {
      prefetchPlanDetail(swipeDeckRows[i]!.id);
    }
  }, [showSwipe, swipeDeckRows]);

  return (
    <Screen
      safeAreaEdges={['top', 'left', 'right']}
      safeAreaStyle={styles.screenBg}
      style={styles.screenBg}
    >
      <AppShellBackground />
      {filterOpen ? (
        <PlansFilterSheet
          visible
          onClose={() => setFilterOpen(false)}
          isPremium={canAdvancedFilters}
          initial={feedFilter}
          discoveryMood={discoveryMood}
          feedMode={feedMode}
          baseRadiusKm={radiusKm}
          effectiveTier={viewerTier}
          onUpgrade={() => {
            setFilterOpen(false);
            router.push('/subscription' as Href);
          }}
          onApply={(next, nextMood, nextFeedMode) => {
            distancePrefetchPagesRef.current = 0;
            setFeedFilter(next);
            setDiscoveryMood(nextMood);
            persistFeedMode(nextFeedMode);
            resetSwipeDeck();
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
                      distanceFilterActive: next.distanceFilterActive,
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
        message="Upgrade to Gold to browse meetups as if you were in another city. Your home base stays saved, and you can turn travel mode off anytime."
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
      {showSwipe ? (
        <View style={styles.swipeColumn}>
          <View style={styles.swipeFeedStrip}>{feedBanner}</View>
          {filteredRows.length === 0 ? (
            <View style={styles.discoverEmptyStage}>{listEmpty}</View>
          ) : standardDiscoverRows.length === 0 ? (
            moodTimelineRows.length > 0 ? (
              <View style={styles.discoverEmptyStage}>
                <DiscoverInlineEmpty
                  icon="flash-outline"
                  title="Mood moments in the timeline"
                  subtitle="Explore the timeline. The swipe deck refreshes when longer meetups appear."
                />
              </View>
            ) : moodFilteredRows.length === 0 ? (
              <View style={styles.discoverEmptyStage}>
                <DiscoverInlineEmpty
                  icon="color-palette-outline"
                  title="Nothing in this vibe"
                  titleAccent="yet"
                  subtitle="Open Filters to try another vibe or choose All."
                  ctaLabel="Open filters"
                  onCtaPress={() => setFilterOpen(true)}
                />
              </View>
            ) : (
              <View style={styles.discoverEmptyStage}>{listEmpty}</View>
            )
          ) : (
            <View style={styles.swipeStage}>
              <View style={styles.swipeDeckZone}>
                <PlansSwipeDeck
                  ref={swipeDeckRef}
                  items={swipeDeckRows}
                  distanceForRow={distanceForRow}
                  viewerHasLocation={viewerHasLocation}
                  presenceForRow={presenceForRow}
                  onSwipeRight={onSwipeInterested}
                  onSwipeLeft={onSwipePass}
                  onPressCard={(row) => openPlanFromFeed(row)}
                  layoutMode="fill"
                />
              </View>
              <View style={[styles.swipeActionsZone, { paddingBottom: tabBarInset + spacing.xs }]}>
                <SwipeActionButtons
                  disabled={swipeDeckRows.length === 0}
                  onPass={() => swipeDeckRef.current?.swipeLeft()}
                  onLike={() => swipeDeckRef.current?.swipeRight()}
                  onInfo={() => {
                    const row = swipeDeckRows[0];
                    if (row) openPlanFromFeed(row);
                  }}
                />
              </View>
            </View>
          )}
          {loadingMore && !feedHydrating && standardDiscoverRows.length > 0 ? (
            <ActivityIndicator style={styles.footerSpinner} color={colors.primary} />
          ) : null}
        </View>
      ) : (
        <Animated.FlatList
          style={styles.list}
          data={standardDiscoverRows}
          keyExtractor={discoverListKeyExtractor}
          extraData={viewerLocationKey}
          ListHeaderComponent={feedBanner}
          contentContainerStyle={[
            styles.listContentPremium,
            discoverFeedEmpty && styles.listContentEmpty,
          ]}
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
            loadingMore && !feedHydrating && standardDiscoverRows.length > 0 ? (
              <ActivityIndicator style={styles.footerSpinner} color={colors.primary} />
            ) : null
          }
          {...tabBarScroll}
        />
      )}
      <PlansFab
        onPress={goCreatePlan}
        bottomOffset={
          showSwipe && (standardDiscoverRows.length > 0 || moodTimelineRows.length > 0)
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
  listContentEmpty: { justifyContent: 'center' },
  discoverEmptyStage: {
    flex: 1,
    minHeight: 280,
    justifyContent: 'center',
  },
  errorBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 74, 114, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 74, 114, 0.25)',
  },
  errorTxt: { fontSize: 14, color: colors.text, fontWeight: '600',
    fontFamily: fonts.medium,},
  meetTypeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.28)',
  },
  meetTypeFilterTxt: { fontSize: 14, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary },
  retry: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  footerSpinner: { marginVertical: spacing.lg },
});
