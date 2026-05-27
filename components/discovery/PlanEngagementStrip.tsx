/**
 * Instagram-style horizontal strip: ongoing meetups, negotiations, chats.
 * Tap → open DM · Long press → plan / agreement detail.
 */
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import type { EngagementCarouselItem, EngagementStripKind } from '@/lib/plans/fetchFeedEngagementCarousel';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbUserPresence } from '@/types/database';
import { Href, router } from 'expo-router';
import { Image } from 'expo-image';
import { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const AVATAR = 56;
const RING = 3;

function stripEmoji(kind: EngagementStripKind): string {
  switch (kind) {
    case 'chat':
      return '💬';
    case 'negotiation':
      return '💰';
    case 'pending':
      return '⏳';
    default:
      return '✨';
  }
}

function ringColor(kind: EngagementStripKind): string {
  switch (kind) {
    case 'chat':
      return colors.primary;
    case 'negotiation':
      return colors.secondary;
    case 'pending':
      return colors.warning;
    default:
      return colors.border;
  }
}

type Props = {
  items: EngagementCarouselItem[];
  loading?: boolean;
  presenceByUser?: Record<string, DbUserPresence>;
};

function PlanEngagementStripInner({ items, loading, presenceByUser }: Props) {
  const { user } = useAuth();

  const openPlan = useCallback((item: EngagementCarouselItem) => {
    if (item.navigateTo === 'agreement') {
      router.push(`/plan/${item.planId}/agreement` as Href);
    } else {
      router.push(`/plan/${item.planId}` as Href);
    }
  }, []);

  const onTap = useCallback(
    async (item: EngagementCarouselItem) => {
      if (!user?.id || !isSupabaseConfigured) return;
      try {
        await openDirectChat(supabase, user.id, item.otherUserId);
      } catch {
        openPlan(item);
      }
    },
    [user?.id, openPlan]
  );

  const showSkeleton = !!loading && items.length === 0;

  if (showSkeleton) {
    return (
      <View style={styles.section}>
        <View style={styles.glass}>
          <Text style={styles.title}>Active</Text>
          <View style={styles.skeletonRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonRing}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.glass}>
          <Text style={styles.title}>Active</Text>
          <View style={styles.emptyRow}>
            <Text style={styles.emptyTxt}>Chats & meetups in progress show here</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.glass}>
        <Text style={styles.title}>Active</Text>
        <FlatList
          data={items}
          keyExtractor={(it) => it.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.listClear}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => {
            const ring = ringColor(item.stripKind);
            const online = presenceByUser?.[item.otherUserId]?.is_online === true;
            const needsAttention = item.stripKind === 'negotiation' || item.stripKind === 'pending';
            return (
              <Pressable
                onPress={() => void onTap(item)}
                onLongPress={() => openPlan(item)}
                delayLongPress={380}
                style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                accessibilityRole="button"
                accessibilityLabel={`${item.otherName}. ${item.planTitle}. Tap to chat, hold for meetup.`}
              >
                <View style={[styles.ring, { borderColor: ring }]}>
                  {item.otherAvatarUrl ? (
                    <Image
                      source={{ uri: item.otherAvatarUrl }}
                      style={styles.avatarImg}
                      contentFit="cover"
                      transition={120}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={styles.avatarPh}>
                      <Text style={styles.avatarPhTxt}>{item.otherName.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  {online ? <View style={styles.onlineDot} /> : null}
                  {needsAttention ? <View style={styles.attentionDot} /> : null}
                  <View style={styles.badge}>
                    <Text style={styles.badgeEmoji}>{stripEmoji(item.stripKind)}</Text>
                  </View>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.otherName}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

export const PlanEngagementStrip = memo(PlanEngagementStripInner);

const styles = StyleSheet.create({
  section: {
    paddingBottom: spacing.xs,
    flexGrow: 0,
    flexShrink: 0,
  },
  glass: {
    marginHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(237, 232, 255, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(108, 99, 255, 0.16)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 0,
      },
      default: {},
    }),
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  listClear: {
    backgroundColor: 'transparent',
  },
  listPad: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  cell: {
    width: AVATAR + 16,
    alignItems: 'center',
  },
  cellPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  ring: {
    width: AVATAR + RING * 2,
    height: AVATAR + RING * 2,
    borderRadius: (AVATAR + RING * 2) / 2,
    borderWidth: RING,
    padding: RING * 0.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.border,
  },
  avatarPh: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.authInputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhTxt: { fontSize: 20, fontWeight: '800', color: colors.primary },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#fff',
  },
  attentionDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeEmoji: { fontSize: 11 },
  name: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    maxWidth: AVATAR + 20,
  },
  emptyRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyTxt: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  skeletonRing: {
    width: AVATAR + RING * 2,
    height: AVATAR + RING * 2,
    borderRadius: (AVATAR + RING * 2) / 2,
    borderWidth: 2,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
