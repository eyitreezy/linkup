import { Avatar } from '@/components/Avatar';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import {
  fetchMatchMakerConnectionHistory,
  historyDurationDays,
  partnerAvatar,
  type MatchMakerHistoryRow,
} from '@/lib/matchmaker/connectionHistory';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatEndedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function MatchMakerHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<MatchMakerHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setRows(await fetchMatchMakerConnectionHistory());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: MM.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={MM.accent} />
      }
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={MM.text} />
        </Pressable>
        <Text style={styles.title}>My Connection History</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.sub}>This is private and visible only to you.</Text>

      {loading ? (
        <ActivityIndicator color={MM.accent} style={{ marginTop: spacing.xl }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No previous connections yet.</Text>
      ) : (
        rows.map((row) => {
          const name = row.partner_name?.trim() || 'Member';
          const days = historyDurationDays(row.connected_at, row.ended_at);
          const outcome = row.outcome_label ?? (row.first_plan_created_at ? 'plan created' : 'ended');
          return (
            <View key={row.connection_id} style={styles.row}>
              <Avatar uri={partnerAvatar(row)} name={name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.meta}>
                  {days} day{days === 1 ? '' : 's'} · {outcome}
                </Text>
                <Text style={styles.ended}>{formatEndedDate(row.ended_at)}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  sub: { marginTop: spacing.sm, marginBottom: spacing.lg, fontFamily: fonts.regular, color: MM.muted },
  empty: { fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MM.border,
  },
  name: { fontFamily: fonts.bold, color: MM.text },
  meta: { fontFamily: fonts.regular, color: MM.muted, fontSize: 13, marginTop: 2 },
  ended: { fontFamily: fonts.regular, color: MM.muted, fontSize: 12, marginTop: 2 },
});
