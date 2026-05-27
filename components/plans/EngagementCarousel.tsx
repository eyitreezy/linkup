/**
 * Horizontal engagements strip with optional auto-advance when there are enough cards.
 */
import { Avatar } from '@/components/Avatar';
import { colors, radius, spacing } from '@/constants/theme';
import type { EngagementCarouselItem } from '@/lib/plans/fetchFeedEngagementCarousel';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const GAP = spacing.sm;
const PAD_L = spacing.md;
const AUTO_MS = 4000;
const RESUME_AFTER_MS = 5000;
const AUTO_MIN_ITEMS = 3;

type Props = {
  items: EngagementCarouselItem[];
  loading?: boolean;
};

export function EngagementCarousel({ items, loading }: Props) {
  const { width: winW } = useWindowDimensions();
  const cardW = Math.min(292, winW - spacing.md * 2 - 24);
  const itemStride = cardW + GAP;

  const listRef = useRef<FlatList<EngagementCarouselItem>>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAuto = useCallback(() => {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
  }, []);

  const clearResume = useCallback(() => {
    if (resumeRef.current) {
      clearTimeout(resumeRef.current);
      resumeRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    clearResume();
    resumeRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, RESUME_AFTER_MS);
  }, [clearResume]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    clearResume();
    scheduleResume();
  }, [clearResume, scheduleResume]);

  useEffect(() => {
    indexRef.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [items]);

  useEffect(() => {
    clearAuto();
    if (items.length < AUTO_MIN_ITEMS) return;
    autoRef.current = setInterval(() => {
      if (pausedRef.current || items.length === 0) return;
      const next = (indexRef.current + 1) % items.length;
      indexRef.current = next;
      try {
        listRef.current?.scrollToIndex({ index: next, animated: true });
      } catch {
        listRef.current?.scrollToOffset({ offset: next * itemStride, animated: true });
      }
    }, AUTO_MS);
    return clearAuto;
  }, [items, clearAuto, itemStride]);

  const onScrollBeginDrag = useCallback(() => {
    pause();
  }, [pause]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(Math.max(0, x) / itemStride);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      indexRef.current = clamped;
      scheduleResume();
    },
    [itemStride, items.length, scheduleResume]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemStride,
      offset: index * itemStride,
      index,
    }),
    [itemStride]
  );

  const onPressCard = useCallback(
    (item: EngagementCarouselItem) => {
      pause();
      if (item.navigateTo === 'agreement') {
        router.push(`/plan/${item.planId}/agreement` as Href);
      } else {
        router.push(`/plan/${item.planId}` as Href);
      }
    },
    [pause]
  );

  const showSkeleton = !!loading && items.length === 0;
  if (!showSkeleton && items.length === 0) return null;

  if (showSkeleton) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your activity</Text>
        <FlatList
          data={[0, 1, 2]}
          keyExtractor={(k) => `sk-${k}`}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollPad, { paddingRight: PAD_L }]}
          renderItem={() => (
            <View style={[styles.card, { width: cardW }, styles.skeletonCard]}>
              <View style={styles.skeletonRow}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonTextCol}>
                  <View style={styles.skeletonLineWide} />
                  <View style={styles.skeletonLineNarrow} />
                </View>
              </View>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Your activity</Text>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(it) => it.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={itemStride}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={[styles.scrollPad, { paddingRight: PAD_L }]}
        getItemLayout={getItemLayout}
        onScrollBeginDrag={onScrollBeginDrag}
        onTouchStart={() => pause()}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.index * itemStride,
            animated: true,
          });
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPressCard(item)}
            style={({ pressed }) => [styles.card, { width: cardW }, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.engagementLabel}: ${item.planTitle}`}
          >
            <View style={styles.cardTop}>
              <Avatar uri={item.otherAvatarUrl} name={item.otherName} size={52} />
              <View style={styles.cardTopText}>
                <Text style={styles.otherName} numberOfLines={1}>
                  {item.otherName}
                </Text>
                <Text style={styles.planTitle} numberOfLines={2}>
                  {item.planTitle}
                </Text>
              </View>
            </View>
            <View style={styles.pillRow}>
              <View style={styles.typePill}>
                <Text style={styles.typePillTxt}>{item.engagementLabel}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillTxt}>{item.statusLabel}</Text>
              </View>
            </View>
            <View style={styles.ctaRow}>
              <Text style={styles.ctaTxt}>{item.navigateTo === 'agreement' ? 'View' : 'Continue'}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  scrollPad: {
    paddingLeft: spacing.md,
    gap: GAP,
  },
  card: {
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  cardTop: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  cardTopText: { flex: 1, minWidth: 0 },
  otherName: { fontSize: 15, fontWeight: '800', color: colors.text },
  planTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  typePillTxt: { fontSize: 11, fontWeight: '800', color: colors.primary },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255, 101, 132, 0.12)',
  },
  statusPillTxt: { fontSize: 11, fontWeight: '800', color: colors.secondary },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  ctaTxt: { fontSize: 14, fontWeight: '800', color: colors.primary },
  skeletonCard: {},
  skeletonRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  skeletonTextCol: { flex: 1, gap: 8 },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8EAEF',
  },
  skeletonLineWide: { height: 14, borderRadius: 7, backgroundColor: '#E8EAEF', width: '80%' },
  skeletonLineNarrow: { height: 12, borderRadius: 6, backgroundColor: '#EEF0F4', width: '55%' },
});
