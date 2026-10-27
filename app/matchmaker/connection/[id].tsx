import { Avatar } from '@/components/Avatar';
import { ConnectionJourneyTimeline } from '@/components/matchmaker/ConnectionJourneyTimeline';
import { CompatibilitySignalChips } from '@/components/matchmaker/CompatibilitySignalChips';
import { MatchMakerDay10NudgeCard } from '@/components/matchmaker/MatchMakerDay10NudgeCard';
import { MatchMakerConnectionReportSheet } from '@/components/matchmaker/MatchMakerConnectionReportSheet';
import { MatchMakerEndConnectionSheet } from '@/components/matchmaker/MatchMakerEndConnectionSheet';
import { MatchMakerSubscriptionLapseBanner } from '@/components/matchmaker/MatchMakerSubscriptionLapseBanner';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { useMatchMakerTabPulse } from '@/hooks/useMatchMakerTabPulse';
import { setMatchMakerFocusedRoute } from '@/lib/matchmaker/tabNavigation';
import { buildCompatibilitySignals, ageFromBirthDate } from '@/lib/matchmaker/compatibility';
import { openMatchMakerChat } from '@/lib/matchmaker/chat';
import {
  buildJourneyMilestones,
  partnerUserId,
  planUnlockCountdownLabel,
} from '@/lib/matchmaker/connection';
import {
  computeMatchMakerJourneyClocks,
  featureLockedExplanation,
} from '@/lib/matchmaker/journey';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { useMatchMakerActivity } from '@/hooks/useMatchMakerActivity';
import { useMatchMakerDay10Nudge } from '@/hooks/useMatchMakerDay10Nudge';
import { MM, MM_CTA_GRADIENT, fonts, spacing } from '@/constants/matchmakerTheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerConnectionScreen() {
  const { id: connectionId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { connection, loading } = useMatchMakerConnection(connectionId);
  const [partner, setPartner] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    birth_date: string | null;
    location_label: string | null;
    verified_badge: boolean;
    bio: string | null;
    preferences?: { interests?: string[] };
  } | null>(null);
  const [readyHidden, setReadyHidden] = useState(false);
  const [readyConfirm, setReadyConfirm] = useState(false);
  const [endSheetOpen, setEndSheetOpen] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const tabPulseKey = useMatchMakerTabPulse();
  const pulseScale = useSharedValue(1);

  const partnerId = connection && user?.id ? partnerUserId(connection, user.id) : null;

  useFocusEffect(
    useCallback(() => {
      if (connectionId) setMatchMakerFocusedRoute(`/matchmaker/connection/${connectionId}`);
      return () => setMatchMakerFocusedRoute(null);
    }, [connectionId])
  );

  useEffect(() => {
    if (!tabPulseKey) return;
    pulseScale.value = withSequence(
      withTiming(1.12, { duration: 120 }),
      withTiming(1, { duration: 180 })
    );
  }, [tabPulseKey, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const isUserA = connection && user?.id ? connection.user_a_id === user.id : false;
  const { activity } = useMatchMakerActivity(connectionId, user?.id, isUserA);

  useEffect(() => {
    if (!partnerId) return;
    void supabase
      .from('profiles')
      .select('display_name, avatar_url, birth_date, location_label, verified_badge, bio, preferences, communication_style')
      .eq('user_id', partnerId)
      .maybeSingle()
      .then(({ data }) => setPartner(data));
  }, [partnerId]);

  useEffect(() => {
    if (!connectionId || !user?.id) return;
    void supabase
      .from('matchmaker_ready_signals')
      .select('id')
      .eq('connection_id', connectionId)
      .eq('signalling_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setReadyHidden(true);
      });
  }, [connectionId, user?.id]);

  useEffect(() => {
    if (!connectionId) return;
    void supabase
      .from('conversations')
      .select('id')
      .eq('matchmaker_connection_id', connectionId)
      .maybeSingle()
      .then(({ data }) => setChatConversationId(data?.id ?? null));
  }, [connectionId]);

  const clocks = useMemo(
    () => (connection ? computeMatchMakerJourneyClocks(connection) : null),
    [connection]
  );

  const { nudge, dismiss: dismissNudge } = useMatchMakerDay10Nudge(
    connection,
    user?.id,
    partner,
    chatConversationId
  );

  const signals = useMemo(() => {
    if (!partner) return [];
    return buildCompatibilitySignals(
      {
        user_id: partnerId ?? '',
        display_name: partner.display_name,
        birth_date: partner.birth_date,
        avatar_url: partner.avatar_url,
        location_label: partner.location_label,
        verified_badge: partner.verified_badge,
        bio: partner.bio,
        interests: partner.preferences?.interests ?? [],
        communication_style: null,
        distance_km: null,
      },
      profile?.communication_style
    );
  }, [partner, partnerId, profile?.communication_style]);

  const sharedActivityComplete = !!activity?.revealed_at;
  const milestones = connection
    ? buildJourneyMilestones(connection, {
        sharedActivityComplete,
        checkInAcknowledged: !nudge.visible && clocks?.checkInUnlocked,
      })
    : [];

  const statusLine = connection ? planUnlockCountdownLabel(connection) : null;
  const partnerName = partner?.display_name?.trim() || 'Member';

  const openChat = useCallback(async () => {
    if (!connectionId || !user?.id || !partnerId) return;
    const { conversationId, error } = await openMatchMakerChat(connectionId, user.id, partnerId);
    if (error || !conversationId) {
      Alert.alert('Chat', error ?? 'Could not open chat');
      return;
    }
    setChatConversationId(conversationId);
    router.push(`/chat/${conversationId}` as Href);
  }, [connectionId, user?.id, partnerId]);

  async function sendReadySignal() {
    if (!connectionId || readyHidden) return;
    const { error } = await supabase.rpc('matchmaker_send_ready_signal', {
      p_connection_id: connectionId,
    });
    if (error) {
      Alert.alert('MatchMaker', error.message);
      return;
    }
    setReadyHidden(true);
    setReadyConfirm(false);
  }

  async function endConnection(reason: string) {
    if (!connectionId || endBusy) return;
    setEndBusy(true);
    const { error } = await supabase.rpc('matchmaker_end_connection', {
      p_connection_id: connectionId,
      p_reason: reason,
    });
    setEndBusy(false);
    if (error) {
      Alert.alert('MatchMaker', error.message);
      return;
    }
    setEndSheetOpen(false);
    router.replace('/matchmaker' as Href);
  }

  if (loading || !connection || connection.status !== 'active') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  if (!clocks) return null;

  const age = ageFromBirthDate(partner?.birth_date);

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.replace('/matchmaker' as Href)} accessibilityLabel="Back to MatchMaker">
            <Ionicons name="chevron-back" size={24} color={MM.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Animated.View style={pulseStyle}>
              <MatchMakerTabIcon size={20} color={MM.accent} active />
            </Animated.View>
            <Text style={styles.headerTitle}>{partnerName} · MatchMaker</Text>
          </View>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            accessibilityLabel="Connection options"
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={MM.muted} />
          </Pressable>
        </View>

        <MatchMakerSubscriptionLapseBanner pausedAt={connection.paused_at} />

        <View style={styles.profile}>
          <View style={styles.photoRing}>
            <Avatar uri={partner?.avatar_url} name={partnerName} size={88} />
          </View>
          <Text style={styles.name}>
            {partnerName}
            {age != null ? `, ${age}` : ''}
          </Text>
          {partner?.location_label ? <Text style={styles.location}>{partner.location_label}</Text> : null}
        </View>

        <MatchMakerDay10NudgeCard nudge={nudge} onDismiss={() => void dismissNudge()} />

        <View style={styles.statusCard}>
          <Text style={styles.statusLine}>Connected · Day {clocks.daysConnected}</Text>
          {statusLine ? <Text style={styles.statusSub}>{statusLine}</Text> : null}
        </View>

        <CompatibilitySignalChips signals={signals} />
        <ConnectionJourneyTimeline milestones={milestones} />

        <View style={styles.actions}>
          <ActionButton label="Open Chat" active onPress={() => void openChat()} />

          <ActionButton
            label="Shared Activity"
            active={clocks.sharedActivityUnlocked}
            onPress={() => router.push(`/matchmaker/connection/${connectionId}/activity` as Href)}
            onLockedPress={() =>
              Alert.alert('Shared Activity', featureLockedExplanation('shared_activity', clocks, connection))
            }
          />

          {!readyHidden && clocks.readySignalUnlocked ? (
            readyConfirm ? (
              <View style={styles.readyConfirm}>
                <Text style={styles.readyConfirmText}>Send a readiness signal to {partnerName}?</Text>
                <View style={styles.readyConfirmRow}>
                  <Pressable onPress={() => void sendReadySignal()} style={styles.readySend}>
                    <Text style={styles.readySendText}>Send signal</Text>
                  </Pressable>
                  <Pressable onPress={() => setReadyConfirm(false)}>
                    <Text style={styles.readyCancel}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <ActionButton
                label="I feel ready to meet"
                active
                onPress={() => setReadyConfirm(true)}
                onLockedPress={() =>
                  Alert.alert('Ready to meet', featureLockedExplanation('ready_signal', clocks, connection))
                }
              />
            )
          ) : !readyHidden ? (
            <ActionButton
              label="I feel ready to meet"
              active={false}
              onLockedPress={() =>
                Alert.alert('Ready to meet', featureLockedExplanation('ready_signal', clocks, connection))
              }
            />
          ) : null}

          <ActionButton
            label="Create Plan"
            active={clocks.planWindowOpen}
            onPress={() => router.push(`/matchmaker/connection/${connectionId}/create-plan` as Href)}
            onLockedPress={() =>
              Alert.alert('Create Plan', featureLockedExplanation('create_plan', clocks, connection))
            }
          />
        </View>

        <Pressable onPress={() => setEndSheetOpen(true)} style={styles.endLink}>
          <Text style={styles.endText}>End this connection</Text>
        </Pressable>
      </ScrollView>

      <MatchMakerEndConnectionSheet
        visible={endSheetOpen}
        partnerName={partnerName}
        busy={endBusy}
        onClose={() => setEndSheetOpen(false)}
        onConfirm={(reason) => void endConnection(reason)}
      />

      <MatchMakerConnectionReportSheet
        visible={reportSheetOpen}
        connectionId={connectionId ?? ''}
        onClose={() => setReportSheetOpen(false)}
      />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                setReportSheetOpen(true);
              }}
            >
              <Text style={styles.menuItemText}>Report this connection</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                router.push('/matchmaker/settings' as Href);
              }}
            >
              <Text style={styles.menuItemText}>MatchMaker settings</Text>
            </Pressable>
            <Pressable style={styles.menuCancel} onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function ActionButton({
  label,
  active,
  onPress,
  onLockedPress,
}: {
  label: string;
  active: boolean;
  onPress?: () => void;
  onLockedPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!active) {
          onLockedPress?.();
          return;
        }
        onPress?.();
      }}
      style={({ pressed }) => [styles.actionWrap, pressed && active && { opacity: 0.92 }]}
    >
      {active ? (
        <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.actionBtn}>
          <Text style={styles.actionActiveText}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.actionBtnDisabled}>
          <Text style={styles.actionDisabledText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  headerTitle: { fontSize: 15, fontFamily: fonts.bold, color: MM.text, textAlign: 'center' },
  profile: { alignItems: 'center', marginBottom: spacing.md },
  photoRing: {
    borderWidth: 2,
    borderColor: MM.accent,
    borderRadius: 999,
    padding: 2,
  },
  name: { marginTop: spacing.sm, fontSize: 20, fontFamily: fonts.bold, color: MM.text },
  location: { fontSize: 13, fontFamily: fonts.regular, color: MM.muted },
  statusCard: {
    backgroundColor: MM.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  statusLine: { fontFamily: fonts.bold, color: MM.text },
  statusSub: { marginTop: 4, fontFamily: fonts.regular, color: MM.muted, fontSize: 13 },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  actionWrap: { borderRadius: 999, overflow: 'hidden' },
  actionBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 999 },
  actionBtnDisabled: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: MM.surface,
    borderWidth: 1,
    borderColor: MM.border,
  },
  actionActiveText: { color: '#fff', fontFamily: fonts.bold },
  actionDisabledText: { color: MM.disabled, fontFamily: fonts.medium },
  readyConfirm: {
    backgroundColor: MM.surfaceWarm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
  },
  readyConfirmText: { fontFamily: fonts.medium, color: MM.text },
  readyConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  readySend: {
    backgroundColor: MM.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  readySendText: { color: '#fff', fontFamily: fonts.bold },
  readyCancel: { fontFamily: fonts.regular, color: MM.muted },
  endLink: { marginTop: spacing.lg, alignItems: 'center' },
  endText: { color: MM.muted, fontSize: 13, fontFamily: fonts.regular },
  menuBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(26, 29, 38, 0.4)' },
  menuSheet: {
    backgroundColor: MM.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: MM.border,
  },
  menuItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: MM.border,
  },
  menuItemText: { fontSize: 16, fontFamily: fonts.medium, color: MM.text },
  menuCancel: { paddingVertical: spacing.md, alignItems: 'center' },
  menuCancelText: { fontSize: 15, fontFamily: fonts.bold, color: MM.muted },
});
