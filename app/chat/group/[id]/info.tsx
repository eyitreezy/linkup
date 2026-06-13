/**
 * Group chat info — members, appearance, safety, leave.
 */
import { Avatar } from '@/components/Avatar';
import { ChatAppearanceSheet } from '@/components/messages/ChatAppearanceSheet';
import { GroupAvatar } from '@/components/messages/GroupAvatar';
import { TierBadge } from '@/components/TierBadge';
import {
  MessageActionsSheet,
  type MessageActionItem,
} from '@/components/messages/MessageActionsSheet';
import { ChatSafetyEntrySheet } from '@/components/trust/ChatSafetyEntrySheet';
import { ReportSheet } from '@/components/trust/ReportSheet';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_CHAT_APPEARANCE,
  loadChatAppearance,
  saveChatAppearance,
  type ChatAppearanceState,
} from '@/lib/messaging/chatAppearance';
import {
  addGroupChatMember,
  fetchActiveGroupMembers,
  leaveGroupChat,
  removeGroupChatMember,
  type GroupChatMemberRow,
} from '@/lib/messaging/groupChatMembers';
import { maxGroupChatMembers } from '@/lib/subscription/groupPlanCaps';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { supabase } from '@/lib/supabase';
import type { SubscriptionTier } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type EligibleGuest = {
  bidderId: string;
  displayName: string;
  avatarUrl: string | null;
  tier: SubscriptionTier;
};

export default function GroupChatInfoScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user, dbUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<GroupChatMemberRow[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [hostTier, setHostTier] = useState<SubscriptionTier>('FREE');
  const [addOpen, setAddOpen] = useState(false);
  const [eligibleGuests, setEligibleGuests] = useState<EligibleGuest[]>([]);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberActions, setMemberActions] = useState<MessageActionItem[] | null>(null);
  const [appearance, setAppearance] = useState<ChatAppearanceState>(DEFAULT_CHAT_APPEARANCE);
  const [nameDraft, setNameDraft] = useState('');

  const viewerMember = useMemo(
    () => members.find((m) => m.user_id === user?.id) ?? null,
    [members, user?.id]
  );
  const isAdmin = !!viewerMember?.is_admin;
  const maxCap = maxGroupChatMembers(hostTier);

  const load = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    setLoading(true);
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('group_name, group_avatar_url, plan_id, created_by')
        .eq('id', conversationId)
        .maybeSingle();
      if (!conv) return;
      setGroupName(conv.group_name ?? 'Group chat');
      setNameDraft(conv.group_name ?? '');
      setGroupAvatarUrl(conv.group_avatar_url ?? null);
      setPlanId(conv.plan_id ?? null);
      if (conv.plan_id) {
        const { data: plan } = await supabase
          .from('plans')
          .select('title, creator_id')
          .eq('id', conv.plan_id)
          .maybeSingle();
        setPlanTitle(plan?.title ?? null);
        if (plan?.creator_id) {
          const { data: hostUser } = await supabase
            .from('users')
            .select('subscription_tier, subscription_expires_at, silver_trial_expires_at, gold_trial_expires_at, has_been_silver_subscriber')
            .eq('id', plan.creator_id)
            .maybeSingle();
          if (hostUser) setHostTier(resolveClientEffectiveTier(hostUser as never));
        }
      }
      const active = await fetchActiveGroupMembers(conversationId);
      setMembers(active);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.id]);

  const openMemberActions = useCallback(
    (member: GroupChatMemberRow) => {
      if (!user?.id || member.user_id === user.id) return;
      const actions: MessageActionItem[] = [
        {
          key: 'report',
          label: 'Report member',
          icon: 'flag-outline',
          destructive: true,
          onPress: () => {
            setSelectedMemberId(member.user_id);
            setReportOpen(true);
          },
        },
      ];
      if (isAdmin && !member.is_admin) {
        actions.push({
          key: 'remove',
          label: 'Remove from group',
          icon: 'person-remove-outline',
          destructive: true,
          onPress: () => {
            if (!conversationId) return;
            Alert.alert('Remove member?', member.user?.display_name ?? 'Member', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                  void removeGroupChatMember(conversationId, member.user_id, user.id)
                    .then(load)
                    .catch((e) => Alert.alert('Could not remove', e.message));
                },
              },
            ]);
          },
        });
      }
      setMemberActions(actions);
    },
    [conversationId, isAdmin, load, user?.id]
  );

  useEffect(() => {
    void load();
    void loadChatAppearance().then(setAppearance);
  }, [load]);

  const loadEligibleGuests = useCallback(async () => {
    if (!planId || !conversationId) return;
    const { data: offers } = await supabase
      .from('plan_offers')
      .select('bidder_id')
      .eq('plan_id', planId)
      .eq('status', 'accepted');
    const existing = new Set(members.map((m) => m.user_id));
    const ids = (offers ?? []).map((o) => o.bidder_id as string).filter((id) => !existing.has(id));
    if (ids.length === 0) {
      setEligibleGuests([]);
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', ids);
    const { data: users } = await supabase.from('users').select('id, subscription_tier').in('id', ids);
    const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
    const tierMap = new Map((users ?? []).map((u) => [u.id as string, u]));
    setEligibleGuests(
      ids.map((id) => {
        const p = profMap.get(id);
        const t = tierMap.get(id);
        return {
          bidderId: id,
          displayName: (p?.display_name as string) ?? 'Guest',
          avatarUrl: (p?.avatar_url as string | null) ?? null,
          tier: (t?.subscription_tier as SubscriptionTier) ?? 'FREE',
        };
      })
    );
  }, [planId, conversationId, members]);

  const saveGroupName = async () => {
    if (!isAdmin || !conversationId) return;
    const next = nameDraft.trim();
    if (!next) return;
    const { error } = await supabase.from('conversations').update({ group_name: next }).eq('id', conversationId);
    if (error) Alert.alert('Could not update', error.message);
    else setGroupName(next);
  };

  const onLeave = () => {
    if (!conversationId || !user?.id) return;
    Alert.alert(`Leave ${groupName}?`, "You won't receive any new messages from this group.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          void leaveGroupChat(conversationId, user.id)
            .then(() => router.replace('/(tabs)/messages' as Href))
            .catch((e) => Alert.alert('Could not leave', e instanceof Error ? e.message : 'Try again'));
        },
      },
    ]);
  };

  if (!conversationId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <GroupAvatar
              avatarUrl={groupAvatarUrl}
              groupName={groupName}
              size={80}
              memberPreviews={members.map((m) => ({
                avatarUrl: m.user?.avatar_url ?? null,
                name: m.user?.display_name ?? 'Member',
              }))}
            />
            {isAdmin ? (
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={() => void saveGroupName()}
                style={styles.nameInput}
              />
            ) : (
              <Text style={styles.groupName}>{groupName}</Text>
            )}
            {planId ? (
              <Pressable onPress={() => router.push(`/plan/${planId}` as Href)} style={styles.planLink}>
                <Text style={styles.planLinkTxt}>Plan: {planTitle ?? 'View plan'}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Members</Text>
          <Text style={styles.sectionSub}>
            {members.length} of {maxCap || '—'}
          </Text>

          {members.map((m) => (
            <Pressable
              key={m.id}
              style={styles.memberRow}
              onPress={() => router.push(`/user/${m.user_id}` as Href)}
              onLongPress={
                m.user_id !== user?.id ? () => openMemberActions(m) : undefined
              }
            >
              <Avatar uri={m.user?.avatar_url ?? null} name={m.user?.display_name ?? '?'} size={48} />
              <View style={styles.memberBody}>
                <Text style={styles.memberName}>{m.user?.display_name ?? 'Member'}</Text>
                {!m.is_admin ? (
                  <TierBadge tier={(m.user?.subscription_tier as SubscriptionTier) ?? 'FREE'} compact />
                ) : null}
              </View>
              {m.is_admin ? (
                <View style={styles.adminPill}>
                  <Text style={styles.adminPillTxt}>ADMIN</Text>
                </View>
              ) : null}
            </Pressable>
          ))}

          {isAdmin ? (
            <Pressable
              style={[styles.actionRow, members.length >= maxCap && styles.actionRowDisabled]}
              disabled={members.length >= maxCap}
              onPress={() => {
                void loadEligibleGuests();
                setAddOpen(true);
              }}
            >
              <Text style={styles.actionLabel}>
                {members.length >= maxCap
                  ? `Group is full (${members.length}/${maxCap})`
                  : 'Add members'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}

          <Pressable style={styles.actionRow} onPress={() => setAppearanceOpen(true)}>
            <Text style={styles.actionLabel}>Appearance</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable style={styles.actionRow} onPress={() => setSafetyOpen(true)}>
            <Text style={styles.actionLabel}>Safety</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {!isAdmin ? (
            <Pressable style={styles.leaveBtn} onPress={onLeave}>
              <Text style={styles.leaveTxt}>Leave group</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add members</Text>
            {eligibleGuests.length === 0 ? (
              <Text style={styles.emptyGuests}>No accepted guests left to add.</Text>
            ) : (
              eligibleGuests.map((g) => (
                <Pressable
                  key={g.bidderId}
                  style={styles.memberRow}
                  onPress={() => {
                    if (!conversationId || !user?.id || !planId) return;
                    void addGroupChatMember(conversationId, g.bidderId, user.id, planId)
                      .then(() => {
                        setAddOpen(false);
                        return load();
                      })
                      .catch((e) => Alert.alert('Could not add', e.message));
                  }}
                >
                  <Avatar uri={g.avatarUrl} name={g.displayName} size={44} />
                  <Text style={styles.memberName}>{g.displayName}</Text>
                  <TierBadge tier={g.tier} compact />
                </Pressable>
              ))
            )}
            <Pressable onPress={() => setAddOpen(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ChatAppearanceSheet
        visible={appearanceOpen}
        value={appearance}
        onClose={() => setAppearanceOpen(false)}
        onSave={(next) => {
          setAppearance(next);
          void saveChatAppearance(next);
        }}
      />
      <ChatSafetyEntrySheet
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        onReportUser={() => {
          Alert.alert('Report a member', 'Long-press a member in the list above to report them.');
        }}
        onPlanDispute={() => {
          if (planId) router.push(`/dispute/${planId}` as Href);
        }}
        canPlanDispute={!!planId}
      />

      <MessageActionsSheet
        visible={memberActions !== null}
        onClose={() => setMemberActions(null)}
        title="Member"
        actions={memberActions ?? []}
      />

      {user?.id && selectedMemberId ? (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          reporterId={user.id}
          reportedUserId={selectedMemberId}
          contentType="user"
          contentId={null}
          title="Report member"
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 36, padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  groupName: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  nameInput: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minWidth: 200,
    paddingVertical: 4,
  },
  planLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planLinkTxt: { fontSize: 14, fontWeight: '700', color: colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  sectionSub: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberBody: { flex: 1, gap: 4 },
  memberName: { fontSize: 16, fontWeight: '700', color: colors.text },
  adminPill: {
    backgroundColor: 'rgba(108,99,255,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  adminPillTxt: { fontSize: 11, fontWeight: '900', color: colors.primary },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionRowDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  leaveBtn: { marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.md },
  leaveTxt: { fontSize: 16, fontWeight: '800', color: colors.secondary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.md, color: colors.text },
  emptyGuests: { color: colors.textMuted, marginBottom: spacing.md },
  modalClose: { alignItems: 'center', paddingVertical: spacing.md },
  modalCloseTxt: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
