import { MatchMakerPoolCard } from '@/components/matchmaker/MatchMakerPoolCard';
import { MatchMakerPoolEmptyState } from '@/components/matchmaker/MatchMakerPoolEmptyState';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { expressMatchMakerInterest, fetchMatchMakerPool } from '@/lib/matchmaker/pool';
import type { MatchMakerPoolEmptyReason, MatchMakerPoolProfile } from '@/lib/matchmaker/types';
import { MM, MM_CTA_GRADIENT, fonts, spacing } from '@/constants/matchmakerTheme';
import { useAuth } from '@/contexts/AuthContext';
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
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<MatchMakerPoolProfile[]>([]);
  const [emptyReason, setEmptyReason] = useState<MatchMakerPoolEmptyReason>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const translateX = useSharedValue(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { profiles: rows, emptyReason: reason } = await fetchMatchMakerPool();
      setProfiles(rows);
      setEmptyReason(reason);
    } catch (e) {
      Alert.alert('MatchMaker', e instanceof Error ? e.message : 'Could not load pool');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

      {loading ? (
        <ActivityIndicator color={MM.accent} style={{ marginTop: 40 }} />
      ) : !top ? (
        <View style={styles.emptyWrap}>
          <MatchMakerPoolEmptyState reason={emptyReason} />
        </View>
      ) : (
        <View style={styles.deck}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.cardWrap, cardStyle]}>
              <MatchMakerPoolCard profile={top} signals={signals} />
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
