/**
 * Meetr — explore meet types in a Tinder-style category grid.
 */
import { MeetTypeExploreCard, MeetTypeExploreCardSkeleton } from '@/components/meetr/MeetTypeExploreCard';
import { MeetTypeReviewPendingModal } from '@/components/plans/create/MeetTypeReviewPendingModal';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { setPendingMeetTypeFilter } from '@/lib/discovery/pendingMeetTypeFilter';
import {
  fetchMeetTypesForUser,
  filterMeetTypesVisibleToUser,
  isCatalogMeetType,
  isMeetTypePendingForUser,
} from '@/lib/plans/meetTypes';
import type { DbMeetType } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTabBarScrollProps } from '@/hooks/useTabBarScrollHandler';
import { useFullBleedAbsoluteFillStyle } from '@/hooks/useFullBleedAbsoluteFillStyle';
import {
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

function columnCount(width: number): number {
  if (width >= 1024) return 4;
  if (width >= 720) return 3;
  return 2;
}

export default function MeetrScreen() {
  const { user } = useAuth();
  const tabBarScroll = useTabBarScrollProps();
  const bleedBgStyle = useFullBleedAbsoluteFillStyle();
  const { width } = useWindowDimensions();
  const cols = columnCount(width);
  const gap = spacing.sm + 2;

  const [types, setTypes] = useState<DbMeetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingTileType, setPendingTileType] = useState<DbMeetType | null>(null);

  const load = useCallback(async () => {
    const { rows } = await fetchMeetTypesForUser(user?.id);
    setTypes(filterMeetTypesVisibleToUser(rows, user?.id));
  }, [user?.id]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const catalogTypes = useMemo(() => types.filter(isCatalogMeetType), [types]);
  const customTypes = useMemo(() => types.filter((t) => !isCatalogMeetType(t)), [types]);

  const cardWidth = useMemo(() => {
    const horizontalPad = spacing.md * 2;
    const totalGap = gap * (cols - 1);
    return (width - horizontalPad - totalGap) / cols;
  }, [width, cols, gap]);

  function onBrowseType(type: DbMeetType) {
    if (isMeetTypePendingForUser(type, user?.id)) {
      setPendingTileType(type);
      setPendingModalOpen(true);
      return;
    }
    setPendingMeetTypeFilter({ id: type.id, name: type.name });
    router.push('/(tabs)' as Href);
  }

  function renderGrid(items: DbMeetType[]) {
    return (
      <View style={[styles.grid, { gap }]}>
        {items.map((type) => (
          <View key={type.id} style={{ width: cardWidth }}>
            <MeetTypeExploreCard type={type} userId={user?.id} onPress={onBrowseType} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <View style={styles.root}>
        <LinearGradient
          colors={['#D2C9FF', '#FFD1E3', '#B8EDD9', colors.discoveryGradientBottom]}
          locations={[0, 0.28, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={bleedBgStyle}
          pointerEvents="none"
        />

        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <LinearGradient
              colors={[colors.primary, '#8B7CFF', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadge}
            >
              <Ionicons name="compass" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Explore</Text>
              <Text style={styles.heroTitle}>Meetr</Text>
              <Text style={styles.heroSub}>
                Pick a vibe you like and we'll show matching plans on Discover.
              </Text>
            </View>
          </View>
        </View>

        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          {...tabBarScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />
          }
        >
          {loading ? (
            <View style={[styles.grid, { gap }]}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={{ width: cardWidth }}>
                  <MeetTypeExploreCardSkeleton />
                </View>
              ))}
            </View>
          ) : types.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="compass-outline" size={40} color={colors.primary} />
              <Text style={styles.emptyTitle}>No meet types yet</Text>
              <Text style={styles.emptySub}>Check back soon, or create a custom type when you post a plan.</Text>
            </View>
          ) : (
            <>
              {catalogTypes.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Browse by vibe</Text>
                  {renderGrid(catalogTypes)}
                </View>
              ) : null}

              {customTypes.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Your meet types</Text>
                  {renderGrid(customTypes)}
                </View>
              ) : null}
            </>
          )}

          <LinearGradient
            colors={[colors.primary, '#8B7CFF', colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createCtaShell}
          >
            <Button
              title="Create a plan with a custom meet type"
              onPress={() => router.push('/plan/create' as Href)}
              pill
              variant="primary"
              style={styles.createCtaInner}
              textStyle={styles.createCtaTxt}
            />
          </LinearGradient>
        </Animated.ScrollView>

        <MeetTypeReviewPendingModal
          visible={pendingModalOpen}
          onClose={() => {
            setPendingModalOpen(false);
            setPendingTileType(null);
          }}
          meetTypeName={pendingTileType?.name ?? ''}
          mode="pending"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent' },
  root: { flex: 1 },
  heroHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSub: { fontSize: 14, fontWeight: '600',
    fontFamily: fonts.medium, color: colors.textMuted, lineHeight: 20 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  section: { marginBottom: spacing.lg },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '900',
    fontFamily: fonts.bold, color: colors.text },
  emptySub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  createCtaShell: {
    marginTop: spacing.lg,
    borderRadius: radius.button,
    padding: 2,
    width: '100%',
  },
  createCtaInner: { backgroundColor: '#fff', width: '100%', margin: 0 },
  createCtaTxt: {
    color: colors.primary,
    fontWeight: '900',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
