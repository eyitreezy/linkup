/**
 * Member-facing subscription history from subscription_events.
 */
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import {
  HIDDEN_SUBSCRIPTION_EVENT_TYPES,
  formatSubscriptionEventDate,
  subscriptionEventIcon,
  subscriptionEventLabel,
} from '@/lib/subscription/subscriptionEventLabels';
import { supabase } from '@/lib/supabase';
import type { DbSubscriptionEvent } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function SubscriptionHistoryScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<DbSubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) {
      setEvents(
        ((data ?? []) as DbSubscriptionEvent[]).filter(
          (e) => !HIDDEN_SUBSCRIPTION_EVENT_TYPES.has(e.event_type)
        )
      );
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.root}>
      <LinearGradient
        colors={[colors.discoveryGradientMid, colors.discoveryGradientBottom, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>Subscription history</Text>
        <View style={styles.navSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : events.length === 0 ? (
        <Text style={styles.empty}>No subscription events yet.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {events.map((event) => {
            const label = subscriptionEventLabel(event);
            if (!label) return null;
            const icon = subscriptionEventIcon(event.event_type);
            return (
              <View key={event.id} style={styles.rowCard}>
                <View style={styles.rowStripe} />
                <View style={styles.rowBody}>
                  <View style={styles.rowLeft}>
                    <View style={styles.rowTypeRow}>
                      <Ionicons name={icon} size={14} color={colors.primary} />
                      <Text style={styles.rowLabel}>{label}</Text>
                    </View>
                    <Text style={styles.rowDate}>{formatSubscriptionEventDate(event.created_at)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  navTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: colors.text },
  navSpacer: { width: 40 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  rowCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  rowStripe: { width: 4, backgroundColor: colors.primary },
  rowBody: { flex: 1, padding: spacing.md },
  rowLeft: { flex: 1 },
  rowTypeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 15, fontWeight: '900', color: colors.text },
  rowDate: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
});
