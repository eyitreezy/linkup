import { Avatar } from '@/components/Avatar';
import { ConnectionJourneyTimeline } from '@/components/matchmaker/ConnectionJourneyTimeline';
import { CompatibilitySignalChips } from '@/components/matchmaker/CompatibilitySignalChips';
import { buildCompatibilitySignals, ageFromBirthDate } from '@/lib/matchmaker/compatibility';
import {
  buildJourneyMilestones,
  daysSince,
  isPlanWindowUnlocked,
  partnerUserId,
  planUnlockCountdownLabel,
} from '@/lib/matchmaker/connection';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { MM, MM_CTA_GRADIENT, fonts, spacing } from '@/constants/matchmakerTheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [readySent, setReadySent] = useState(false);

  const partnerId = connection && user?.id ? partnerUserId(connection, user.id) : null;

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
      .then(({ data }) => setReadySent(!!data));
  }, [connectionId, user?.id]);

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

  const milestones = connection ? buildJourneyMilestones(connection) : [];
  const daysConnected = connection ? daysSince(connection.connected_at) : 0;
  const planUnlocked = connection ? isPlanWindowUnlocked(connection) : false;
  const statusLine = connection ? planUnlockCountdownLabel(connection) : null;

  const openChat = useCallback(async () => {
    if (!connectionId || !user?.id || !partnerId) return;
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('matchmaker_connection_id', connectionId)
      .maybeSingle();
    if (existing?.id) {
      router.push(`/chat/${existing.id}` as Href);
      return;
    }
    const ordered = user.id < partnerId ? { user_a: user.id, user_b: partnerId } : { user_a: partnerId, user_b: user.id };
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ ...ordered, matchmaker_connection_id: connectionId, is_group_chat: false })
      .select('id')
      .single();
    if (error) {
      Alert.alert('Chat', error.message);
      return;
    }
    router.push(`/chat/${created.id}` as Href);
  }, [connectionId, user?.id, partnerId]);

  async function sendReadySignal() {
    if (!connectionId || !user?.id || readySent) return;
    await supabase.rpc('matchmaker_send_ready_signal', {
      p_connection_id: connectionId,
    });
    setReadySent(true);
  }

  if (loading || !connection) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  const age = ageFromBirthDate(partner?.birth_date);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={MM.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{partner?.display_name ?? 'MatchMaker'}</Text>
        <Pressable onPress={() => router.push('/matchmaker/settings' as Href)}>
          <Ionicons name="ellipsis-horizontal" size={22} color={MM.muted} />
        </Pressable>
      </View>

      <View style={styles.profile}>
        <Avatar uri={partner?.avatar_url} name={partner?.display_name ?? 'Member'} size={88} />
        <Text style={styles.name}>
          {partner?.display_name ?? 'Member'}
          {age != null ? `, ${age}` : ''}
        </Text>
        {partner?.location_label ? <Text style={styles.location}>{partner.location_label}</Text> : null}
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLine}>Connected · Day {daysConnected}</Text>
        {statusLine ? <Text style={styles.statusSub}>{statusLine}</Text> : null}
      </View>

      <CompatibilitySignalChips signals={signals} />
      <ConnectionJourneyTimeline milestones={milestones} />

      <View style={styles.actions}>
        <ActionButton label="Open Chat" active onPress={() => void openChat()} />
        <ActionButton
          label="Shared Activity"
          active={daysConnected >= 7}
          lockedLabel="Unlocks Day 7"
          onPress={() => router.push(`/matchmaker/connection/${connectionId}/activity` as Href)}
        />
        <ActionButton
          label="I feel ready to meet"
          active={daysConnected >= 10 && !readySent}
          lockedLabel={readySent ? 'Signal sent' : 'Day 10+'}
          onPress={() => void sendReadySignal()}
        />
        <ActionButton
          label="Create Plan"
          active={planUnlocked}
          lockedLabel="Day 21+"
          onPress={() => router.push('/plan/create' as Href)}
        />
      </View>

      <Pressable onPress={() => router.push(`/matchmaker/connection/${connectionId}/end` as Href)} style={styles.endLink}>
        <Text style={styles.endText}>End this connection</Text>
      </Pressable>
    </ScrollView>
  );
}

function ActionButton({
  label,
  active,
  lockedLabel,
  onPress,
}: {
  label: string;
  active: boolean;
  lockedLabel?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!active}
      onPress={() => {
        if (!active) {
          if (lockedLabel) Alert.alert(label, lockedLabel);
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
  headerTitle: { fontSize: 17, fontFamily: fonts.bold, color: MM.text },
  profile: { alignItems: 'center', marginBottom: spacing.md },
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
  endLink: { marginTop: spacing.lg, alignItems: 'center' },
  endText: { color: MM.muted, fontSize: 13, fontFamily: fonts.regular },
});
