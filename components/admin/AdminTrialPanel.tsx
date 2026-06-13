/**
 * Admin — grant, extend, revoke trials and view subscription events.
 */
import { TierBadge } from '@/components/TierBadge';
import { colors, radius, spacing } from '@/constants/theme';
import {
  HIDDEN_SUBSCRIPTION_EVENT_TYPES,
  formatSubscriptionEventDate,
  subscriptionEventLabel,
} from '@/lib/subscription/subscriptionEventLabels';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { supabase } from '@/lib/supabase';
import type { DbSubscriptionEvent, DbUser } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

type Props = {
  user: DbUser;
  onUserUpdated?: () => void;
};

export function AdminTrialPanel({ user, onUserUpdated }: Props) {
  const [userRow, setUserRow] = useState(user);
  const [busy, setBusy] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [events, setEvents] = useState<DbSubscriptionEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const refetchUser = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    if (data) setUserRow(data as DbUser);
    onUserUpdated?.();
  }, [user.id, onUserUpdated]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    const { data, error } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) Alert.alert('Events', error.message);
    else {
      setEvents(
        ((data ?? []) as DbSubscriptionEvent[]).filter(
          (e) => !HIDDEN_SUBSCRIPTION_EVENT_TYPES.has(e.event_type)
        )
      );
    }
    setEventsLoading(false);
  }, [user.id]);

  useEffect(() => {
    setUserRow(user);
  }, [user]);

  async function handleTrialAction(trialType: 'silver' | 'gold', action: 'grant' | 'extend' | 'revoke') {
    setBusy(true);
    const { error } = await supabase.rpc('admin_adjust_trial', {
      p_user_id: user.id,
      p_trial_type: trialType,
      p_action: action,
      p_days: 7,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Trial action failed', error.message);
      return;
    }
    await refetchUser();
  }

  const effectiveTier = resolveClientEffectiveTier(userRow);
  const silverActive =
    userRow.silver_trial_expires_at && new Date(userRow.silver_trial_expires_at) > new Date();
  const goldActive =
    userRow.gold_trial_expires_at && new Date(userRow.gold_trial_expires_at) > new Date();

  return (
    <View style={styles.panel}>
      <View style={styles.headRow}>
        <Ionicons name="diamond-outline" size={20} color={colors.primary} />
        <Text style={styles.panelTitle}>Trials & subscription</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Effective tier</Text>
        <TierBadge tier={effectiveTier} compact />
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Subscription</Text>
        <Text style={styles.statusValue}>
          {userRow.subscription_tier}
          {userRow.subscription_expires_at ? ` · until ${formatDate(userRow.subscription_expires_at)}` : ''}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Silver trial</Text>
        <Text style={styles.statusValue}>
          {userRow.silver_trial_activated_at
            ? silverActive
              ? `Active until ${formatDate(userRow.silver_trial_expires_at)}`
              : 'Used (expired)'
            : 'Never used'}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Gold trial</Text>
        <Text style={styles.statusValue}>
          {userRow.gold_trial_activated_at
            ? goldActive
              ? `Active until ${formatDate(userRow.gold_trial_expires_at)}`
              : 'Used (expired)'
            : 'Never used'}
        </Text>
      </View>
      {userRow.premium_until ? (
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Legacy premium</Text>
          <Text style={styles.statusValue}>until {formatDate(userRow.premium_until)}</Text>
        </View>
      ) : null}

      {(['silver', 'gold'] as const).map((trialType) => (
        <View key={trialType} style={styles.trialActionGroup}>
          <Text style={styles.trialActionLabel}>{trialType === 'silver' ? 'Silver' : 'Gold'} trial</Text>
          <View style={styles.trialActionButtons}>
            <Pressable
              onPress={() => void handleTrialAction(trialType, 'grant')}
              disabled={busy}
              style={styles.trialActionBtn}
            >
              <Text style={styles.trialActionButtonText}>Grant 7d</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleTrialAction(trialType, 'extend')}
              disabled={busy}
              style={styles.trialActionBtn}
            >
              <Text style={styles.trialActionButtonText}>+7d</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleTrialAction(trialType, 'revoke')}
              disabled={busy}
              style={styles.trialActionBtn}
            >
              <Text style={[styles.trialActionButtonText, styles.trialActionRevoke]}>Revoke</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => {
          setShowEventsModal(true);
          void loadEvents();
        }}
        style={styles.viewEventsLink}
      >
        <Text style={styles.viewEventsLinkText}>View subscription events →</Text>
      </Pressable>

      <Modal visible={showEventsModal} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEventsModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Subscription events</Text>
            {eventsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : events.length === 0 ? (
              <Text style={styles.empty}>No events.</Text>
            ) : (
              <ScrollView style={styles.eventsScroll}>
                {events.map((event) => {
                  const label = subscriptionEventLabel(event);
                  if (!label) return null;
                  return (
                    <View key={event.id} style={styles.eventRow}>
                      <Text style={styles.eventLabel}>{label}</Text>
                      <Text style={styles.eventDate}>{formatSubscriptionEventDate(event.created_at)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <Pressable onPress={() => setShowEventsModal(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  panelTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  statusLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  statusValue: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'right' },
  trialActionGroup: { marginTop: spacing.md },
  trialActionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  trialActionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trialActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
    backgroundColor: colors.surface,
  },
  trialActionButtonText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  trialActionRevoke: { color: colors.danger },
  viewEventsLink: { marginTop: spacing.md, paddingVertical: spacing.sm },
  viewEventsLinkText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  eventsScroll: { maxHeight: 320 },
  eventRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  eventLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  eventDate: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  empty: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  modalClose: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalCloseTxt: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
