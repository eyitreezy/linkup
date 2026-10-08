import { Screen } from '@/components/Screen';
import { MatchMakerInterestCard } from '@/components/matchmaker/MatchMakerInterestCard';
import {
  MatchMakerInterestsSegmentedControl,
  type MatchMakerInterestSegment,
} from '@/components/matchmaker/MatchMakerInterestsSegmentedControl';
import { MatchMakerSectionHeader } from '@/components/matchmaker/MatchMakerSectionHeader';
import { MatchMakerStickyTopNav } from '@/components/matchmaker/MatchMakerStickyTopNav';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useMatchMakerInterests } from '@/hooks/useMatchMakerInterests';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { markMatchMakerInterestQueueOpened } from '@/lib/matchmaker/interestQueueSeen';
import { goBackOrFallback } from '@/lib/navigation/goBackOrFallback';
import {
  expressMatchMakerInterest,
  passMatchMakerInterest,
} from '@/lib/matchmaker/pool';
import type { MatchMakerInterestItem } from '@/lib/matchmaker/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function EmptyInterestsState({ segment }: { segment: MatchMakerInterestSegment }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="heart-outline" size={36} color={MM.accent} />
      </View>
      <Text style={styles.emptyHeading}>
        {segment === 'received'
          ? 'No one has expressed interest yet.'
          : 'You have not sent interest yet.'}
      </Text>
      <Text style={styles.emptySub}>
        {segment === 'received'
          ? 'Keep browsing. Your match is in the pool.'
          : 'Browse the pool and express interest when someone stands out.'}
      </Text>
    </View>
  );
}

export default function MatchMakerInterestQueueScreen() {
  const { user, profile } = useAuth();
  const { queue, loading, error, refresh, sentCount, receivedCount } = useMatchMakerInterests(
    user?.id
  );
  const [segment, setSegment] = useState<MatchMakerInterestSegment>('received');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void markMatchMakerInterestQueueOpened(user.id);
    }, [user?.id])
  );

  const list = segment === 'sent' ? queue.sent : queue.received;

  const signalMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of list) {
      map.set(item.id, buildCompatibilitySignals(item.profile, profile?.communication_style));
    }
    return map;
  }, [list, profile?.communication_style]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  async function onExpressBack(item: MatchMakerInterestItem) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const result = await expressMatchMakerInterest(item.from_user_id);
      if (result.matched && result.connection_id) {
        router.replace(`/matchmaker/connection/${result.connection_id}` as Href);
        return;
      }
      if (result.already_sent) {
        await refresh();
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onPass(item: MatchMakerInterestItem) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await passMatchMakerInterest(item.from_user_id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const listHeader = (
    <>
      <View style={styles.leadBlock}>
        <LinearGradient
          colors={[MM.primary, MM.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.leadAccent}
        />
        <View style={styles.leadTextCol}>
          <Text style={styles.leadKicker}>MatchMaker</Text>
          <Text style={styles.leadTitle}>People who expressed interest</Text>
          <Text style={styles.leadSub}>
            Review who sent interest your way, or see profiles you have already expressed interest in.
          </Text>
        </View>
      </View>

      <MatchMakerSectionHeader title="Sent and received" icon="heart-outline" />

      <MatchMakerInterestsSegmentedControl
        value={segment}
        onChange={setSegment}
        sentCount={sentCount}
        receivedCount={receivedCount}
      />
    </>
  );

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <MatchMakerStickyTopNav
          onBack={() => goBackOrFallback('/matchmaker' as Href)}
        />

        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {listHeader}
              {loading && list.length === 0 ? (
                <ActivityIndicator color={MM.accent} style={{ marginTop: spacing.lg }} />
              ) : null}
              {error && list.length === 0 ? (
                <View style={styles.errorBlock}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable onPress={() => void refresh()} style={styles.retryBtn}>
                    <Text style={styles.retryText}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <MatchMakerInterestCard
              item={item}
              signals={signalMap.get(item.id) ?? []}
              mode={segment}
              busy={busyId === item.id}
              onPressProfile={() =>
                router.push({
                  pathname: '/matchmaker/profile/[userId]',
                  params: { userId: item.profile.user_id },
                } as Href)
              }
              onExpressBack={() => void onExpressBack(item)}
              onPass={() => void onPass(item)}
            />
          )}
          ListEmptyComponent={
            !loading && !error ? <EmptyInterestsState segment={segment} /> : null
          }
          contentContainerStyle={list.length === 0 ? styles.listEmptyContent : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={MM.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: MM.bg },
  flex: { flex: 1 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 56,
  },
  leadTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: MM.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: MM.text,
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: MM.muted,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  errorBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: MM.muted,
    textAlign: 'center',
  },
  retryBtn: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: MM.border,
    backgroundColor: MM.surface,
  },
  retryText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: MM.accent,
  },
  listContent: { paddingBottom: spacing.xl * 2 },
  listEmptyContent: { flexGrow: 1, paddingBottom: spacing.xl },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: MM.surfaceWarm,
    borderWidth: 1,
    borderColor: MM.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyHeading: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: MM.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: MM.muted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
});
