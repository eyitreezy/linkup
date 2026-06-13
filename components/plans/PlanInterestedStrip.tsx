/**
 * Host view — interested users strip (Gold+) or blurred upsell.
 */
import { Avatar } from '@/components/Avatar';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { colors, radius, spacing } from '@/constants/theme';
import { usePermission } from '@/hooks/usePermission';
import { fetchHiddenEngagementUserIds } from '@/lib/plans/incognitoEngagement';
import { supabase } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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

export function PlanInterestedStrip({ planId, hostUserId, currentUserId }: Props) {
  const { allowed, loading: permLoading } = usePermission('plans.see_all_likes', {
    skip: currentUserId !== hostUserId,
  });
  const [rows, setRows] = useState<EngRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: eng } = await supabase
      .from('plan_engagements')
      .select('user_id, kind, created_at')
      .eq('plan_id', planId)
      .in('kind', ['view', 'save'])
      .order('created_at', { ascending: false })
      .limit(20);

    const userIds = [...new Set((eng ?? []).map((e) => e.user_id as string))];
    if (userIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const incognitoIds = await fetchHiddenEngagementUserIds(userIds);
    const visibleIds = userIds.filter((uid) => !incognitoIds.has(uid));
    if (visibleIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', visibleIds);

    setRows((profiles ?? []) as EngRow[]);
    setLoading(false);
  }, [allowed, planId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (currentUserId !== hostUserId) return null;

  if (permLoading || loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!allowed) {
    return (
      <Pressable style={styles.wrap} onPress={() => setUpgradeOpen(true)}>
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
        <Text style={styles.title}>Interested</Text>
        <View style={styles.blurRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.blurAvatar} />
          ))}
          <Text style={styles.blurTxt}>Upgrade to see who is interested</Text>
        </View>
      </Pressable>
    );
  }

  const shown = rows.slice(0, 5);
  const overflow = rows.length - shown.length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Interested</Text>
      <View style={styles.avatarRow}>
        {shown.map((r) => (
          <Pressable key={r.user_id} onPress={() => router.push(`/user/${r.user_id}` as Href)}>
            <Avatar uri={r.avatar_url} name={r.display_name ?? '?'} size={44} />
          </Pressable>
        ))}
        {overflow > 0 ? <Text style={styles.moreTxt}>+ {overflow} more</Text> : null}
      </View>
      {rows.length > 0 ? (
        <Pressable
          style={styles.connectBtn}
          onPress={() => router.push(`/plan/${planId}/negotiate` as Href)}
          accessibilityRole="button"
          accessibilityLabel="Connect with all interested members via manage offers"
        >
          <Text style={styles.connectTxt}>Connect with all →</Text>
        </Pressable>
      ) : (
        <Text style={styles.emptyTxt}>No views or saves yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: spacing.sm },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  moreTxt: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  connectBtn: { marginTop: spacing.sm },
  connectTxt: { fontSize: 14, fontWeight: '800', color: colors.primary },
  emptyTxt: { fontSize: 13, color: colors.textMuted },
  blurRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blurAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(200,200,210,0.8)',
  },
  blurTxt: { fontSize: 14, fontWeight: '700', color: colors.textMuted, flex: 1 },
});
