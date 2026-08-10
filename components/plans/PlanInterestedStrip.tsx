/**
 * Host view — interested users strip (Gold+) or gated upsell (matches linkup-web).
 */
import { Avatar } from '@/components/Avatar';
import { SkeletonBox } from '@/components/ui/SkeletonBox';
import { TierBadge } from '@/components/TierBadge';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { usePermission } from '@/hooks/usePermission';
import {
  fetchHiddenEngagementUserIds,
  filterEngagementsByIncognito,
} from '@/lib/plans/incognitoEngagement';
import { removeSupabaseChannel, supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type EngRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  planId: string;
  hostUserId: string;
  currentUserId: string;
};

const BLUR_STACK = [0, 1, 2] as const;
const LAVENDER_STACK = '#D2C9FF';

export function PlanInterestedStrip({ planId, hostUserId, currentUserId }: Props) {
  const { allowed, loading: permLoading } = usePermission('plans.see_all_likes', {
    skip: currentUserId !== hostUserId,
  });
  const [rows, setRows] = useState<EngRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [interestCount, setInterestCount] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const { data: eng } = await supabase
      .from('plan_engagements')
      .select('user_id, kind, created_at')
      .eq('plan_id', planId)
      .in('kind', ['view', 'save'])
      .order('created_at', { ascending: false })
      .limit(40);

    const engagements = eng ?? [];
    const userIds = [...new Set(engagements.map((e) => e.user_id as string))];
    const hiddenIds = await fetchHiddenEngagementUserIds(userIds);
    const visible = filterEngagementsByIncognito(engagements, hiddenIds);
    const visibleUserIds = [...new Set(visible.map((e) => e.user_id as string))];
    setInterestCount(visibleUserIds.length);

    if (!allowed) {
      setRows([]);
      return;
    }

    if (visibleUserIds.length === 0) {
      setRows([]);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', visibleUserIds);

    const filteredProfiles = (profiles ?? []).filter(
      (p) => !hiddenIds.has(p.user_id as string)
    );
    setRows(filteredProfiles as EngRow[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, planId]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (currentUserId !== hostUserId || !planId) return;

    const channel = supabase.channel(
      `plan-interest-strip:${planId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
    );

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_engagements',
          filter: `plan_id=eq.${planId}`,
        },
        () => {
          void loadRef.current();
        }
      )
      .subscribe();

    return () => {
      removeSupabaseChannel(channel);
    };
  }, [currentUserId, hostUserId, planId]);

  if (currentUserId !== hostUserId) return null;

  if (permLoading || loading) {
    return (
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Interested</Text>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
        <View style={styles.avatarRow}>
          {BLUR_STACK.map((i) => (
            <SkeletonBox key={i} style={styles.avatarSkeleton} />
          ))}
        </View>
      </View>
    );
  }

  if (!allowed) {
    const interestLabel =
      interestCount === 1
        ? '1 person is interested'
        : `${interestCount} people are interested`;

    return (
      <View style={styles.wrap}>
        <UpgradePrompt
          visible={upgradeOpen}
          feature="plans.see_all_likes"
          requiredTier="GOLD"
          onUpgrade={() => {
            setUpgradeOpen(false);
            router.push('/subscription' as Href);
          }}
          onDismiss={() => setUpgradeOpen(false)}
        />
        <Pressable
          style={({ pressed }) => [styles.gatedRow, pressed && styles.gatedPressed]}
          onPress={() => setUpgradeOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to Gold to see who is interested"
        >
          <View style={styles.avatarStack}>
            {BLUR_STACK.map((i) => (
              <View
                key={i}
                style={[styles.blurAvatar, i > 0 && styles.blurAvatarOverlap]}
              />
            ))}
          </View>
          <View style={styles.gatedCopy}>
            <Text style={styles.gatedTitle}>{interestLabel}</Text>
            <Text style={styles.gatedSub}>Upgrade to Gold to see who</Text>
          </View>
          <TierBadge tier="GOLD" compact />
          <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  const shown = rows.slice(0, 5);
  const overflow = rows.length - shown.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Interested</Text>
        {rows.length > 0 ? (
          <Pressable
            onPress={() => router.push(`/plan/${planId}/interest` as Href)}
            accessibilityRole="button"
            accessibilityLabel="Connect with all interested members"
            hitSlop={8}
          >
            <Text style={styles.connectLink}>Connect with all →</Text>
          </Pressable>
        ) : null}
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyTxt}>No interest yet.</Text>
      ) : (
        <View style={styles.avatarRow}>
          {shown.map((r) => (
            <Pressable
              key={r.user_id}
              onPress={() => router.push(`/user/${r.user_id}` as Href)}
              style={styles.avatarRing}
              accessibilityRole="button"
              accessibilityLabel={r.display_name ?? 'View profile'}
            >
              <Avatar uri={r.avatar_url} name={r.display_name ?? '?'} size={40} />
            </Pressable>
          ))}
          {overflow > 0 ? (
            <View style={styles.morePill}>
              <Text style={styles.morePillTxt}>+{overflow} more</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarRing: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  gatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gatedPressed: { opacity: 0.92 },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blurAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LAVENDER_STACK,
    borderWidth: 2,
    borderColor: colors.surface,
    opacity: 0.92,
  },
  blurAvatarOverlap: {
    marginLeft: -10,
  },
  gatedCopy: {
    flex: 1,
    minWidth: 0,
  },
  gatedTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.15,
  },
  gatedSub: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  connectLink: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  avatarSkeleton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  morePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: LAVENDER_STACK,
  },
  morePillTxt: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  emptyTxt: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
});
