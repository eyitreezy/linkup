import { MatchMakerFilterSheet } from '@/components/matchmaker/MatchMakerFilterSheet';
import { MatchMakerPoolCard } from '@/components/matchmaker/MatchMakerPoolCard';
import { MatchMakerPoolEmptyState } from '@/components/matchmaker/MatchMakerPoolEmptyState';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MM, MM_CTA_GRADIENT, fonts, spacing } from '@/constants/matchmakerTheme';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import {
  defaultMatchMakerFilter,
  type MatchMakerFilterState,
} from '@/lib/matchmaker/filterState';
import { expressMatchMakerInterest, fetchMatchMakerPool } from '@/lib/matchmaker/pool';
import type { MatchMakerPoolEmptyReason, MatchMakerPoolProfile } from '@/lib/matchmaker/types';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const W = Dimensions.get('window').width;
const SWIPE_THRESHOLD = W * 0.4;

export function MatchMakerPool() {
  const insets = useSafeAreaInsets();
  const { profile, dbUser } = useAuth();
  const [profiles, setProfiles] = useState<MatchMakerPoolProfile[]>([]);
  const [emptyReason, setEmptyReason] = useState<MatchMakerPoolEmptyReason>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<MatchMakerFilterState>(defaultMatchMakerFilter());
  const translateX = useSharedValue(0);

  const baseRadiusKm = profile?.radius_km ? Number(profile.radius_km) : 50;
  const effectiveTier = resolveClientEffectiveTier(dbUser);

  const load = useCallback(async (activeFilter: MatchMakerFilterState) => {
    setLoading(true);
    try {
      const { profiles: rows, emptyReason: reason } = await fetchMatchMakerPool(20, {
        maxDistanceKm: activeFilter.maxDistanceKm,
        sortBy: activeFilter.sortBy,
      });
      setProfiles(rows);
      setEmptyReason(reason);
    } catch (e) {
      Alert.alert('MatchMaker', e instanceof Error ? e.message : 'Could not load pool');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const poolCount = profiles.length;
  const top = profiles[0] ?? null;
  const signals = useMemo(
    () => (top ? buildCompatibilitySignals(top, profile?.communication_style) : []),
    [top, profile?.communication_style]
  );

  const commitAction = useCallback(
    async (direction: 'left' | 'right') => {
      if (!top || busy) return;
      setBusy(true);
      try {
        if (direction === 'right') {
          const result = await expressMatchMakerInterest(top.user_id);
          if (result.matched && result.connection_id) {
            router.replace(`/matchmaker/connection/${result.connection_id}` as Href);
            return;
          }
        }
        setProfiles((prev) => prev.slice(1));
      } catch (e) {
        Alert.alert('MatchMaker', e instanceof Error ? e.message : 'Action failed');
      } finally {
        setBusy(false);
        translateX.value = 0;
      }
    },
    [top, busy, translateX]
  );

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(W, { duration: 160 }, () => runOnJS(commitAction)('right'));
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-W, { duration: 160 }, () => runOnJS(commitAction)('left'));
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: `${translateX.value / 30}deg` }],
  }));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MatchMakerTabIcon size={22} color={MM.accent} active />
        <Text style={styles.headerTitle}>MatchMaker</Text>
        <Pressable onPress={() => router.push('/matchmaker/settings' as Href)} hitSlop={12}>
          <Ionicons name="settings-outline" size={22} color={MM.muted} />
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.poolCount}>
          {poolCount} member{poolCount === 1 ? '' : 's'} in your pool
          {filter.filterActive ? ' · filtered' : ''}
        </Text>
        <Pressable
          onPress={() => setFilterOpen(true)}
          style={({ pressed }) => [
            styles.filterBtn,
            filter.filterActive && styles.filterBtnActive,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Filter pool"
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={filter.filterActive ? MM.accent : colors.text}
          />
          {filter.filterActive ? <View style={styles.filterDot} /> : null}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={MM.accent} />
        </View>
      ) : !top ? (
        <View style={styles.emptyWrap}>
          <MatchMakerPoolEmptyState reason={emptyReason} />
        </View>
      ) : (
        <View style={styles.deck}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.cardWrap, cardStyle]}>
              <MatchMakerPoolCard
                profile={top}
                signals={signals}
                onPressProfile={() =>
                  router.push({
                    pathname: '/matchmaker/profile/[userId]',
                    params: {
                      userId: top.user_id,
                      ...(top.distance_km != null ? { distance_km: String(top.distance_km) } : {}),
                    },
                  } as Href)
                }
              />
            </Animated.View>
          </GestureDetector>
        </View>
      )}

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={() => void commitAction('left')}
          disabled={!top || busy}
          style={({ pressed }) => [styles.passBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="close" size={28} color={MM.muted} />
        </Pressable>
        <Pressable
          onPress={() => void commitAction('right')}
          disabled={!top || busy}
          style={({ pressed }) => [styles.likeWrap, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.likeBtn}>
            <Ionicons name="heart" size={28} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>

      <MatchMakerFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        baseRadiusKm={baseRadiusKm}
        effectiveTier={effectiveTier}
        onApply={setFilter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, fontWeight: '800', color: MM.text },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  poolCount: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    borderColor: MM.accent,
    backgroundColor: '#FDF8F4',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: MM.accent,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  emptyWrap: { flex: 1 },
  deck: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  cardWrap: { flex: 1 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.md,
  },
  passBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: MM.disabled,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MM.surface,
  },
  likeWrap: { borderRadius: 32, overflow: 'hidden' },
  likeBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
