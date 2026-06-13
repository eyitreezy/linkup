/**
 * Group plan chat thread — reuses 1:1 message infrastructure with group header + members.
 */
import { ChatAppearanceSheet } from '@/components/messages/ChatAppearanceSheet';
import { GroupAvatar } from '@/components/messages/GroupAvatar';
import { ChatBubble, ChatBubbleStatus, type ChatBubbleMeta } from '@/components/messages/ChatBubble';
import type { ChatBubbleMedia } from '@/components/messages/ChatBubble';
import {
  MessageActionsSheet,
  type MessageActionItem,
} from '@/components/messages/MessageActionsSheet';
import {
  MessageDeleteConfirmModal,
  type MessageDeleteKind,
} from '@/components/messages/MessageDeleteConfirmModal';
import { ChatComposer } from '@/components/messages/ChatComposer';
import { ForwardMessageSheet } from '@/components/messages/ForwardMessageSheet';
import { PinnedMessageBanner } from '@/components/messages/PinnedMessageBanner';
import { ChatSafetyEntrySheet } from '@/components/trust/ChatSafetyEntrySheet';
import { ReportSheet } from '@/components/trust/ReportSheet';
import { colors, radius, spacing } from '@/constants/theme';
import { useKeyboardAnimation } from '@/hooks/useKeyboardAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import { usePresenceActions } from '@/contexts/PresenceContext';
import { useAuth } from '@/contexts/AuthContext';
import { moderateMessageText } from '@/lib/ai';
import {
  CHAT_PAGE_SIZE,
  fetchMessagesOlderThan,
  buildReplyQuoteFromTarget,
  messageCopyText,
  messageDisplayText,
  mimeToMediaKind,
  normalizeChatMessageRow,
  parseLegacyImageBody,
  resolveReplyQuote,
  runMessageSelect,
  type ChatMessageRow,
  type ChatMediaRow,
  type ReplyQuotePreview,
} from '@/lib/messaging/chatQueries';
import {
  fetchConversationPin,
  pinConversationMessage,
  unpinConversationMessage,
  type ConversationPinState,
} from '@/lib/messaging/conversationPin';
import { fetchForwardTargets, type ForwardTarget } from '@/lib/messaging/fetchForwardTargets';
import { forwardMessage } from '@/lib/messaging/forwardMessage';
import { buildMessageActions, messageActionMediaMeta } from '@/lib/messaging/buildMessageActions';
import { deleteMessageForEveryone } from '@/lib/messaging/deleteMessage';
import { editMessage } from '@/lib/messaging/editMessage';
import {
  fetchHiddenMessageIdsForConversation,
  filterMessagesHiddenForUser,
  hideMessageForMe,
} from '@/lib/messaging/messageDeletions';
import {
  fetchActiveGroupMembers,
  type GroupChatMemberRow,
} from '@/lib/messaging/groupChatMembers';
import { subscribeGroupMembersRealtime } from '@/lib/messaging/subscribeGroupMembersRealtime';
import { subscribeConversationRealtime } from '@/lib/messaging/subscribeConversationRealtime';
import {
  DEFAULT_CHAT_APPEARANCE,
  fontSizeFromScale,
  fontWeightFromEmphasis,
  loadChatAppearance,
  presetForState,
  resolveBubbleTheme,
  saveChatAppearance,
  type ChatAppearanceState,
} from '@/lib/messaging/chatAppearance';
import { setConversationLastRead } from '@/lib/messaging/inboxCache';
import { resolveClientEffectiveTier } from '@/lib/subscription/effectiveTier';
import { subscribeThreadMessagesRealtime } from '@/lib/messaging/subscribeThreadMessagesRealtime';
import { persistModerationAfterSend } from '@/lib/trust/persistModeration';
import {
  isMessagingFullyVerified,
  startOfUtcDayIso,
  UNVERIFIED_DAILY_MESSAGE_CAP,
} from '@/lib/messaging/trustCaps';
import { readLocalAssetAsUint8Array } from '@/lib/nativeImageRead';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { File as ExpoFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProfilePreferences } from '@/types/database';

const MAX_VIDEO_BYTES = 14 * 1024 * 1024;

function shortTimeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

type UiMessage = ChatMessageRow & { tempKey?: string; sendFailed?: boolean };

type EditModalState = { messageId: string; draft: string } | null;

export default function GroupChatThreadScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { composerLiftStyle, chatListFooterStyle, typingBackdropStyle } = useKeyboardAnimation();
  const { user, dbUser, profile } = useAuth();
  const { signalTyping, clearTyping } = usePresenceActions();
  const [groupMeta, setGroupMeta] = useState<{
    name: string;
    avatarUrl: string | null;
    planId: string | null;
    planTitle: string | null;
  } | null>(null);
  const [members, setMembers] = useState<GroupChatMemberRow[]>([]);
  const viewerTier = resolveClientEffectiveTier(dbUser);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [mediaById, setMediaById] = useState<Record<string, ChatMediaRow>>({});
  const [signedByPath, setSignedByPath] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [messageActionItems, setMessageActionItems] = useState<MessageActionItem[] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    kind: MessageDeleteKind;
    message: UiMessage;
  } | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyQuotePreview | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [pinState, setPinState] = useState<ConversationPinState>({
    pinnedMessageId: null,
    pinnedAt: null,
    pinnedBy: null,
  });
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardSource, setForwardSource] = useState<UiMessage | null>(null);
  const [forwardTargets, setForwardTargets] = useState<ForwardTarget[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardBusyId, setForwardBusyId] = useState<string | null>(null);
  const [copyAck, setCopyAck] = useState(false);
  const [hiddenForMeIds, setHiddenForMeIds] = useState<Set<string>>(() => new Set());
  const pinStateRef = useRef(pinState);
  pinStateRef.current = pinState;
  const [reportOpen, setReportOpen] = useState(false);
  const [safetySheetOpen, setSafetySheetOpen] = useState(false);
  const [selectedReportUserId, setSelectedReportUserId] = useState<string | null>(null);
  const [contactBlockedOpen, setContactBlockedOpen] = useState(false);
  const contactBlockFromSendRef = useRef(false);
  const listRef = useRef<FlatList<UiMessage>>(null);
  const verifiedUser = isMessagingFullyVerified(dbUser?.verification_status);

  const [appearance, setAppearance] = useState<ChatAppearanceState>(DEFAULT_CHAT_APPEARANCE);
  const [appearanceSheetOpen, setAppearanceSheetOpen] = useState(false);

  useEffect(() => {
    void loadChatAppearance().then(setAppearance);
  }, []);

  const chatPreset = useMemo(() => presetForState(appearance), [appearance]);
  const bubbleTheme = useMemo(() => resolveBubbleTheme(chatPreset, appearance), [chatPreset, appearance]);
  const messageInputLook = useMemo(
    () => ({
      sendActive: chatPreset.sendActive,
      inputBg: chatPreset.composerInputBg,
      inputText: chatPreset.composerInputText,
      inputBorder: chatPreset.composerInputBorder,
      inputPlaceholder: chatPreset.composerInputPlaceholder,
      attachIcon: chatPreset.composerAttachIcon,
      fontSize: fontSizeFromScale(appearance.fontScale),
      fontWeight: fontWeightFromEmphasis(appearance.fontEmphasis),
    }),
    [chatPreset, appearance.fontScale, appearance.fontEmphasis]
  );

  const memberByUserId = useMemo(() => {
    const map = new Map<string, GroupChatMemberRow>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  const senderDisplayName = useCallback(
    (senderId: string | null, fallback?: string | null) => {
      if (!senderId) return fallback ?? 'System';
      const member = memberByUserId.get(senderId);
      return member?.user?.display_name ?? fallback ?? 'Member';
    },
    [memberByUserId]
  );

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessageRow>();
    for (const m of messages) {
      if (!m.tempKey) map.set(m.id, m);
    }
    return map;
  }, [messages]);

  const hasMediaForMessage = useCallback(
    (messageId: string) => {
      if (mediaById[messageId]) return true;
      const m = messagesById.get(messageId);
      if (!m) return false;
      return !!parseLegacyImageBody(messageDisplayText(m));
    },
    [mediaById, messagesById]
  );

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) {
        Alert.alert('Message not loaded', 'Scroll up to load older messages, then try again.');
        return;
      }
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId((cur) => (cur === messageId ? null : cur)), 2200);
    },
    [messages]
  );

  useEffect(() => {
    if (!conversationId || !user || !isSupabaseConfigured) return;
    (async () => {
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('is_group_chat, group_name, group_avatar_url, plan_id')
        .eq('id', conversationId)
        .maybeSingle();
      if (error || !conv?.is_group_chat) {
        Alert.alert('Group chat', 'This group chat is unavailable.');
        router.back();
        return;
      }
      const { data: membership } = await supabase
        .from('group_chat_members')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .is('removed_at', null)
        .maybeSingle();
      if (!membership) {
        Alert.alert('Group chat', 'You are not a member of this group.');
        router.back();
        return;
      }
      let planTitle: string | null = null;
      if (conv.plan_id) {
        const { data: plan } = await supabase.from('plans').select('title').eq('id', conv.plan_id).maybeSingle();
        planTitle = plan?.title ?? null;
      }
      setGroupMeta({
        name: conv.group_name ?? 'Group chat',
        avatarUrl: conv.group_avatar_url ?? null,
        planId: conv.plan_id ?? null,
        planTitle,
      });
    })();
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured) return;
    return subscribeGroupMembersRealtime(conversationId, setMembers);
  }, [conversationId]);

  const hydrateSigned = useCallback(async (rows: Record<string, ChatMediaRow>) => {
    const updates: Record<string, string> = {};
    await Promise.all(
      Object.values(rows).map(async (m) => {
        const key = `${m.storage_bucket}:${m.storage_path}`;
        const { data, error } = await supabase.storage
          .from(m.storage_bucket)
          .createSignedUrl(m.storage_path, 3600);
        if (!error && data?.signedUrl) updates[key] = data.signedUrl;
      })
    );
    if (Object.keys(updates).length > 0) {
      setSignedByPath((prev) => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(updates)) {
          if (!merged[k]) merged[k] = v;
        }
        return merged;
      });
    }
  }, []);

  const hydrateSignedRef = useRef(hydrateSigned);
  hydrateSignedRef.current = hydrateSigned;

  const loadInitial = useCallback(async () => {
    if (!conversationId || !isSupabaseConfigured) return;
    setLoading(true);
    setHasMore(true);
    try {
      const hidden =
        user?.id ? await fetchHiddenMessageIdsForConversation(user.id, conversationId) : [];
      const hiddenSet = new Set(hidden);
      setHiddenForMeIds(hiddenSet);

      const { messages: chunk, mediaByMessageId } = await fetchMessagesOlderThan(
        conversationId,
        undefined,
        CHAT_PAGE_SIZE
      );
      setMessages(filterMessagesHiddenForUser(chunk, hiddenSet));
      setMediaById(mediaByMessageId);
      await hydrateSigned(mediaByMessageId);
      setHasMore(chunk.length >= CHAT_PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [conversationId, hydrateSigned, user?.id]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMore || loadingMore || messages.length === 0) return;
    const oldest = messages[0];
    if (oldest.tempKey) return;
    setLoadingMore(true);
    try {
      const { messages: older, mediaByMessageId } = await fetchMessagesOlderThan(
        conversationId,
        oldest.created_at,
        CHAT_PAGE_SIZE
      );
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      setMediaById((prev) => ({ ...prev, ...mediaByMessageId }));
      await hydrateSigned(mediaByMessageId);
      setMessages((prev) => {
        const merged = [...older, ...prev];
        const seen = new Set<string>();
        const deduped = merged.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        return filterMessagesHiddenForUser(deduped, hiddenForMeIds);
      });
      if (older.length < CHAT_PAGE_SIZE) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, messages, hydrateSigned, hiddenForMeIds]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured) return;
    void fetchConversationPin(conversationId).then(setPinState);
    return subscribeConversationRealtime(conversationId, {
      onPinChange: setPinState,
    });
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured) return;

    return subscribeThreadMessagesRealtime(conversationId, {
      onInsert: async (row) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        });
        let r: ChatMediaRow | null = null;
        if (row.media_id) {
          const { data: byFk } = await supabase
            .from('media')
            .select('parent_id, mime_type, storage_bucket, storage_path')
            .eq('id', row.media_id)
            .maybeSingle();
          if (byFk) {
            r = {
              parent_id: row.id,
              mime_type: byFk.mime_type as string | null,
              storage_bucket: byFk.storage_bucket as string,
              storage_path: byFk.storage_path as string,
            };
          }
        }
        if (!r) {
          const { data: med } = await supabase
            .from('media')
            .select('parent_id, mime_type, storage_bucket, storage_path')
            .eq('parent_table', 'messages')
            .eq('parent_id', row.id)
            .maybeSingle();
          if (med?.parent_id) r = med as ChatMediaRow;
        }
        if (r) {
          setMediaById((p) => ({ ...p, [row.id]: r }));
          await hydrateSignedRef.current({ [row.id]: r });
        }
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      },
      onUpdate: async (row) => {
        const normalized = normalizeChatMessageRow(row as unknown as Record<string, unknown>);
        setMessages((prev) => prev.map((m) => (m.id === normalized.id ? { ...m, ...normalized } : m)));
        if (normalized.deleted_at && pinStateRef.current.pinnedMessageId === normalized.id) {
          void unpinConversationMessage(conversationId).then((r) => {
            if (r.ok) setPinState({ pinnedMessageId: null, pinnedAt: null, pinnedBy: null });
          });
        }
        if (normalized.deleted_at || !normalized.media_id) {
          setMediaById((p) => {
            if (!p[normalized.id]) return p;
            const next = { ...p };
            delete next[normalized.id];
            return next;
          });
        }
        if (!normalized.media_id) return;
        const { data: byFk } = await supabase
          .from('media')
          .select('parent_id, mime_type, storage_bucket, storage_path')
          .eq('id', normalized.media_id)
          .maybeSingle();
        if (byFk) {
          const r: ChatMediaRow = {
            parent_id: normalized.id,
            mime_type: byFk.mime_type as string | null,
            storage_bucket: byFk.storage_bucket as string,
            storage_path: byFk.storage_path as string,
          };
          setMediaById((p) => ({ ...p, [normalized.id]: r }));
          await hydrateSignedRef.current({ [normalized.id]: r });
        }
      },
      onDelete: (id) => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setMediaById((p) => {
          if (!p[id]) return p;
          const next = { ...p };
          delete next[id];
          return next;
        });
      },
    });
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const real = messages.filter((m) => !m.tempKey);
    const last = real[real.length - 1];
    if (last) void setConversationLastRead(conversationId, last.created_at);
  }, [conversationId, messages]);

  const countTodaySends = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .gte('created_at', startOfUtcDayIso());
    if (error) return 0;
    return count ?? 0;
  }, [user]);

  const dismissContactBlockedModal = useCallback(async () => {
    setContactBlockedOpen(false);
    if (!contactBlockFromSendRef.current) return;
    contactBlockFromSendRef.current = false;
    const { data, error } = await supabase.rpc('record_contact_share_strike');
    if (error) return;
    const row = data as { strike_count?: number; status?: string } | null;
    const n = row?.strike_count ?? 0;
    const st = row?.status;
    if (st === 'banned') {
      Alert.alert('Account update', 'Your account access has been restricted.');
      return;
    }
    if (st === 'suspended') {
      Alert.alert('Suspension', 'Your account is temporarily suspended after repeated attempts.');
      return;
    }
    if (n <= 1) {
      Alert.alert(
        'Heads up',
        'This attempt was logged. Keep phone numbers and social handles on LinkUp until your plan is fully complete on both sides.'
      );
    } else if (n === 2) {
      Alert.alert('Final warning', 'Another attempt may result in a temporary suspension.');
    }
  }, []);

  const assertOutgoingContactAllowed = useCallback(async (_snippet: string) => true, []);

  const sendText = useCallback(async () => {
    if (!user || !conversationId || !text.trim() || sending) return;

    if (dbUser?.account_status === 'suspended' || dbUser?.account_status === 'banned') {
      Alert.alert(
        'Messaging paused',
        'Your account can’t send messages right now. Check your inbox for a notice.'
      );
      return;
    }

    if (!verifiedUser) {
      const n = await countTodaySends();
      if (n >= UNVERIFIED_DAILY_MESSAGE_CAP) {
        Alert.alert(
          'Daily message limit',
          `Unverified accounts can send up to ${UNVERIFIED_DAILY_MESSAGE_CAP} messages per day. Verify your profile for unlimited messaging.`
        );
        return;
      }
    }

    const body = text.trim();
    const contactOk = await assertOutgoingContactAllowed(body);
    if (!contactOk) return;

    clearTyping();
    const mod = await moderateMessageText(body);

    if (mod.status === 'blocked') {
      Alert.alert('Message blocked', mod.reason ?? 'Policy violation');
      return;
    }
    if (mod.status === 'flagged') {
      Alert.alert('Heads up', 'This message may be reviewed under our safety policies.');
    }

    const replyId = replyTarget?.messageId ?? null;
    const tempKey = `temp-${Date.now()}`;
    const optimistic: UiMessage = {
      id: tempKey,
      tempKey,
      text: body,
      body,
      media_id: null,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      reply_to_message_id: replyId,
      is_forwarded: false,
      forwarded_from_message_id: null,
      receipt_hidden: false,
    };
    setMessages((p) => [...p, optimistic]);
    setText('');
    setReplyTarget(null);
    setSending(true);

    const insertPayload: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_id: user.id,
      text: body,
      moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
    };
    if (replyId) insertPayload.reply_to_message_id = replyId;

    const { data, error } = await runMessageSelect((cols) =>
      supabase
        .from('messages')
        .insert(insertPayload)
        .select(cols)
        .single()
    );

    setSending(false);

    if (error || !data) {
      setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: true } : m)));
      Alert.alert('Could not send', error?.message ?? 'Could not send message');
      return;
    }

    const sentRow = normalizeChatMessageRow(data as unknown as Record<string, unknown>);

    void persistModerationAfterSend({
      contentType: 'message',
      contentId: sentRow.id,
      textSample: body,
    });

    setMessages((p) => {
      const without = p.filter((m) => m.tempKey !== tempKey);
      const row = sentRow;
      if (without.some((m) => m.id === row.id)) return without;
      return [...without, row];
    });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [
    user,
    conversationId,
    text,
    sending,
    verifiedUser,
    countTodaySends,
    clearTyping,
    dbUser?.account_status,
    assertOutgoingContactAllowed,
    replyTarget?.messageId,
  ]);

  const retryOptimistic = useCallback(
    async (tempKey: string) => {
      const msg = messages.find((m) => m.tempKey === tempKey);
      if (!msg || !user || !conversationId) return;
      setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: false } : m)));
      const snippet = messageDisplayText(msg) ?? '';
      const contactOk = await assertOutgoingContactAllowed(snippet);
      if (!contactOk) {
        setMessages((p) => p.filter((m) => m.tempKey !== tempKey));
        return;
      }
      const mod = await moderateMessageText(snippet);
      if (mod.status === 'blocked') {
        Alert.alert('Message blocked', mod.reason ?? 'Policy violation');
        setMessages((p) => p.filter((m) => m.tempKey !== tempKey));
        return;
      }
      const insertPayload: Record<string, unknown> = {
        conversation_id: conversationId,
        sender_id: user.id,
        text: snippet,
        moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
      };
      if (msg.reply_to_message_id) insertPayload.reply_to_message_id = msg.reply_to_message_id;

      const { data, error } = await runMessageSelect((cols) =>
        supabase.from('messages').insert(insertPayload).select(cols).single()
      );
      if (error || !data) {
        setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: true } : m)));
        Alert.alert('Could not send', error?.message ?? 'Could not send message');
        return;
      }
      const sentRow = normalizeChatMessageRow(data as unknown as Record<string, unknown>);
      void persistModerationAfterSend({
        contentType: 'message',
        contentId: sentRow.id,
        textSample: snippet,
      });
      setMessages((p) => {
        const without = p.filter((m) => m.tempKey !== tempKey);
        const row = sentRow;
        if (without.some((m) => m.id === row.id)) return without;
        return [...without, row];
      });
    },
    [messages, user, conversationId, assertOutgoingContactAllowed]
  );

  const runDeleteForMe = useCallback(
    async (m: UiMessage) => {
      if (!user?.id || !conversationId) return;
      const result = await hideMessageForMe(user.id, m.id, conversationId);
      if (!result.ok) {
        Alert.alert('Could not delete', result.error);
        return;
      }
      setHiddenForMeIds((prev) => new Set([...prev, m.id]));
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    },
    [user?.id, conversationId]
  );

  const runDeleteForEveryone = useCallback(
    async (m: UiMessage) => {
      if (!user?.id) return;
      const result = await deleteMessageForEveryone(supabase, m, user.id);
      if (!result.ok) {
        Alert.alert('Could not delete', result.error);
        return;
      }
      const row = result.row;
      setMessages((prev) => prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)));
      setMediaById((p) => {
        if (!p[m.id]) return p;
        const next = { ...p };
        delete next[m.id];
        return next;
      });
    },
    [user?.id]
  );

  const saveEditedMessage = useCallback(async () => {
    if (!editModal || !user || !conversationId) return;
    const body = editModal.draft.trim();
    if (!body) {
      Alert.alert('Empty message', 'Add some text or cancel.');
      return;
    }
    const contactOk = await assertOutgoingContactAllowed(body);
    if (!contactOk) return;
    const mod = await moderateMessageText(body);
    if (mod.status === 'blocked') {
      Alert.alert('Message blocked', mod.reason ?? 'Policy violation');
      return;
    }
    if (mod.status === 'flagged') {
      Alert.alert('Heads up', 'This message may be reviewed under our safety policies.');
    }
    const source = messages.find((m) => m.id === editModal.messageId);
    if (!source) {
      Alert.alert('Could not update', 'Message not found.');
      setEditModal(null);
      return;
    }
    const result = await editMessage(
      supabase,
      source,
      user.id,
      body,
      mod.status === 'flagged' ? 'flagged' : 'clean'
    );
    if (!result.ok) {
      if (result.code !== 'unchanged') {
        Alert.alert('Could not update', result.error);
      }
      if (result.code === 'unchanged' || result.code === 'window_expired') {
        setEditModal(null);
      }
      return;
    }
    setEditModal(null);
    void persistModerationAfterSend({
      contentType: 'message',
      contentId: editModal.messageId,
      textSample: body,
    });
    setMessages((prev) => prev.map((m) => (m.id === result.row.id ? { ...m, ...result.row } : m)));
  }, [editModal, user, conversationId, messages, assertOutgoingContactAllowed]);

  const openForwardSheet = useCallback(
    async (m: UiMessage) => {
      if (!user?.id) return;
      setForwardSource(m);
      setForwardOpen(true);
      setForwardLoading(true);
      try {
        const targets = await fetchForwardTargets(user.id, conversationId);
        setForwardTargets(targets);
      } catch {
        setForwardTargets([]);
      } finally {
        setForwardLoading(false);
      }
    },
    [user?.id, conversationId]
  );

  const runForwardTo = useCallback(
    async (target: ForwardTarget) => {
      if (!forwardSource || !user?.id) return;
      setForwardBusyId(target.conversationId);
      const result = await forwardMessage({
        source: forwardSource,
        sourceMedia: mediaById[forwardSource.id] ?? null,
        targetConversationId: target.conversationId,
        senderId: user.id,
      });
      setForwardBusyId(null);
      if (!result.ok) {
        Alert.alert('Could not forward', result.error);
        return;
      }
      setForwardOpen(false);
      setForwardSource(null);
      Alert.alert('Forwarded', `Message sent to ${target.name}.`, [
        { text: 'Stay here', style: 'cancel' },
        {
          text: 'Open chat',
          onPress: () => router.push(`/chat/${target.conversationId}` as Href),
        },
      ]);
    },
    [forwardSource, user?.id, mediaById]
  );

  const runPinMessage = useCallback(
    async (m: UiMessage) => {
      if (!conversationId || !user?.id) return;
      const result = await pinConversationMessage(conversationId, m.id, user.id);
      if (!result.ok) {
        Alert.alert('Could not pin', result.error);
        return;
      }
      setPinState({
        pinnedMessageId: m.id,
        pinnedAt: new Date().toISOString(),
        pinnedBy: user.id,
      });
    },
    [conversationId, user?.id]
  );

  const runUnpinMessage = useCallback(async () => {
    if (!conversationId) return;
    const result = await unpinConversationMessage(conversationId);
    if (!result.ok) {
      Alert.alert('Could not unpin', result.error);
      return;
    }
    setPinState({ pinnedMessageId: null, pinnedAt: null, pinnedBy: null });
  }, [conversationId]);

  const showMessageActions = useCallback(
    (m: UiMessage) => {
      if (m.tempKey || !user) return;
      const { hasMedia, mediaKind } = messageActionMediaMeta(m, mediaById[m.id]);
      const copyText = messageCopyText(m, { hasMedia, mediaKind });
      const rawText = messageDisplayText(m)?.trim() ?? '';

      const items = buildMessageActions({
        message: m,
        viewerId: user.id,
        viewerTier,
        pinnedMessageId: pinState.pinnedMessageId,
        hiddenForViewer: hiddenForMeIds.has(m.id),
        hasMedia,
        mediaKind,
        isGroupChat: true,
        handlers: {
          onReply: () => {},
          onCopy: () => {
            void Clipboard.setStringAsync(copyText).then(() => {
              setCopyAck(true);
              setTimeout(() => setCopyAck(false), 1800);
            });
          },
          onForward: () => void openForwardSheet(m),
          onEdit: () => setEditModal({ messageId: m.id, draft: rawText }),
          onPin: () => void runPinMessage(m),
          onUnpin: () => void runUnpinMessage(),
          onDeleteForMe: () => {
            setMessageActionItems(null);
            setDeleteConfirm({ kind: 'for_me', message: m });
          },
          onDeleteForEveryone: () => {
            setMessageActionItems(null);
            setDeleteConfirm({ kind: 'for_everyone', message: m });
          },
        },
      });

      if (items.length === 0) return;
      setMessageActionItems(items);
    },
    [
      user,
      viewerTier,
      hiddenForMeIds,
      pinState.pinnedMessageId,
      openForwardSheet,
      runPinMessage,
      runUnpinMessage,
      runDeleteForMe,
      runDeleteForEveryone,
      mediaById,
    ]
  );

  const pickAndSendMedia = useCallback(async () => {
    if (!user || !conversationId) return;

    if (dbUser?.account_status === 'suspended' || dbUser?.account_status === 'banned') {
      Alert.alert(
        'Messaging paused',
        'Your account can’t send messages right now. Check your inbox for a notice.'
      );
      return;
    }

    if (!verifiedUser) {
      Alert.alert('Verification required', 'Verify your profile to send photos and videos.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      videoMaxDuration: 60,
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;

    const asset = res.assets[0];
    const isVideo = asset.type === 'video';

    if (isVideo) {
      const f = new ExpoFile(asset.uri);
      if (f.exists) {
        const info = f.info();
        if (info.size != null && info.size > MAX_VIDEO_BYTES) {
          Alert.alert('Video too large', 'Choose a shorter clip under ~14 MB.');
          return;
        }
      }
    }

    setSending(true);
    try {
      let uploadUri = asset.uri;
      let contentType = isVideo ? 'video/mp4' : 'image/jpeg';
      let ext = isVideo ? 'mp4' : 'jpg';

      if (!isVideo) {
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
        );
        uploadUri = manipulated.uri;
      }

      const caption = text.trim() || null;
      if (caption) {
        const ok = await assertOutgoingContactAllowed(caption);
        if (!ok) return;
      }
      const mediaInsertPayload: Record<string, unknown> = {
        conversation_id: conversationId,
        sender_id: user.id,
        text: caption,
        moderation_status: 'pending',
      };
      if (replyTarget?.messageId) mediaInsertPayload.reply_to_message_id = replyTarget.messageId;

      const { data: inserted, error: insErr } = await runMessageSelect((cols) =>
        supabase.from('messages').insert(mediaInsertPayload).select(cols).single()
      );

      if (insErr || !inserted) {
        Alert.alert('Error', insErr?.message ?? 'Could not create message');
        return;
      }

      const insertedRow = normalizeChatMessageRow(inserted as Record<string, unknown>);
      const msgId = insertedRow.id;
      const path = `${user.id}/${msgId}-${Date.now()}.${ext}`;
      const bytes = await readLocalAssetAsUint8Array(uploadUri);
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, bytes, {
        contentType,
        upsert: false,
      });
      if (upErr) {
        await supabase.from('messages').delete().eq('id', msgId);
        Alert.alert('Upload failed', upErr.message);
        return;
      }

      const { data: medRow, error: medErr } = await supabase
        .from('media')
        .insert({
          parent_table: 'messages',
          parent_id: msgId,
          storage_bucket: 'chat-media',
          storage_path: path,
          mime_type: contentType,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (medErr || !medRow) {
        await supabase.from('messages').delete().eq('id', msgId);
        await supabase.storage.from('chat-media').remove([path]);
        Alert.alert('Error', medErr?.message ?? 'Could not save attachment');
        return;
      }

      const { error: updErr } = await supabase
        .from('messages')
        .update({ media_id: medRow.id })
        .eq('id', msgId);
      if (updErr) {
        await supabase.from('media').delete().eq('id', medRow.id);
        await supabase.from('messages').delete().eq('id', msgId);
        await supabase.storage.from('chat-media').remove([path]);
        Alert.alert('Error', updErr.message);
        return;
      }

      const finalized: ChatMessageRow = { ...insertedRow, media_id: medRow.id };

      setMediaById((p) => ({
        ...p,
        [msgId]: {
          parent_id: msgId,
          mime_type: contentType,
          storage_bucket: 'chat-media',
          storage_path: path,
        },
      }));
      const { data: urlData } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
      if (urlData?.signedUrl) {
        setSignedByPath((prev) => ({ ...prev, [`chat-media:${path}`]: urlData.signedUrl }));
      }

      setMessages((p) => (p.some((x) => x.id === msgId) ? p : [...p, finalized]));
      void persistModerationAfterSend({
        contentType: 'message',
        contentId: msgId,
        textSample: caption ?? '',
      });
      clearTyping();
      setText('');
      setReplyTarget(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } finally {
      setSending(false);
    }
  }, [
    user,
    conversationId,
    text,
    verifiedUser,
    clearTyping,
    dbUser?.account_status,
    assertOutgoingContactAllowed,
    replyTarget?.messageId,
  ]);

  const onQuickSendOffer = useCallback(() => {
    if (groupMeta?.planId) {
      router.push(`/plan/${groupMeta.planId}` as Href);
      return;
    }
    Alert.alert(
      'Send an offer',
      'Open a hangout from Discover to connect, or continue one you’ve already started.',
      [
        { text: 'Discover', onPress: () => router.push('/' as Href) },
        { text: 'Not now', style: 'cancel' },
      ]
    );
  }, [groupMeta?.planId]);

  const suggestMeetingArea = useCallback(async () => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (!fg.granted) {
        Alert.alert('Location off', 'Allow location to add a friendly “I’m around…” line to your message.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const label = [place?.city, place?.subregion].filter(Boolean).join(', ');
      const line = label
        ? `I'm usually around ${label} — happy to meet somewhere public nearby.`
        : `I'm nearby — let's pick a public spot that works for both of us.`;
      setText((t) => (t.trim() ? `${t.trim()}\n` : '') + line);
    } catch {
      Alert.alert('Location', 'Could not read your area right now.');
    }
  }, []);

  const chatListFooter = useCallback(
    () => <Animated.View style={chatListFooterStyle} />,
    [chatListFooterStyle]
  );

  const pinnedPreview = useMemo(() => {
    const pinId = pinState.pinnedMessageId;
    if (!pinId) return null;
    if (hiddenForMeIds.has(pinId)) return null;
    const pinned = messagesById.get(pinId);
    if (!pinned) return null;
    if (pinned.deleted_at) return null;
    const mine = pinned.sender_id === user?.id;
    const senderLabel = mine ? 'You' : senderDisplayName(pinned.sender_id);
    const hasMedia = hasMediaForMessage(pinId);
    const quote = buildReplyQuoteFromTarget(
      pinned,
      senderDisplayName(pinned.sender_id),
      user?.id ?? '',
      hasMedia
    );
    return { messageId: pinId, senderLabel, preview: quote.preview };
  }, [pinState.pinnedMessageId, messagesById, user?.id, senderDisplayName, hasMediaForMessage, hiddenForMeIds]);

  const bubblePropsFor = useCallback(
    (m: UiMessage): { body: string | null; media: ChatBubbleMedia | null; legacy: string | null } => {
      if (m.deleted_at) return { body: null, media: null, legacy: null };
      const rowMedia = mediaById[m.id];
      const display = messageDisplayText(m);
      const legacy = parseLegacyImageBody(display);
      const key = rowMedia ? `${rowMedia.storage_bucket}:${rowMedia.storage_path}` : '';
      const url = key ? signedByPath[key] : null;
      const kind = mimeToMediaKind(rowMedia?.mime_type);
      let media: ChatBubbleMedia | null = null;
      if (url && kind) media = { kind, displayUrl: url };
      return { body: display, media, legacy: legacy && !rowMedia ? legacy : null };
    },
    [mediaById, signedByPath]
  );

  if (!conversationId) {
    return null;
  }

  const thread = (
    <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.threadBg} pointerEvents="none">
          <LinearGradient
            colors={chatPreset.threadGradient}
            locations={chatPreset.locations ?? [0, 0.3, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {appearance.backgroundImageUri ? (
            <ImageBackground
              source={{ uri: appearance.backgroundImageUri }}
              style={StyleSheet.absoluteFill}
              imageStyle={styles.wallpaperImage}
            >
              <View style={styles.wallpaperDim} />
            </ImageBackground>
          ) : null}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.threadBg, styles.typingBackdrop, typingBackdropStyle]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.98)', 'rgba(243,238,255,0.94)', 'rgba(255,248,252,0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { borderBottomColor: chatPreset.headerHairline }]}
        >
          <View style={[styles.header, { paddingTop: spacing.sm }]}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.headerMid}
              onPress={() =>
                conversationId && router.push(`/chat/group/${conversationId}/info` as Href)
              }
              accessibilityRole="button"
              accessibilityLabel="Group info"
            >
              <GroupAvatar
                avatarUrl={groupMeta?.avatarUrl}
                groupName={groupMeta?.name ?? 'Group'}
                size={44}
                memberPreviews={members.map((m) => ({
                  avatarUrl: m.user?.avatar_url ?? null,
                  name: m.user?.display_name ?? 'Member',
                }))}
              />
              <View style={styles.headerNameCol}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerName} numberOfLines={1}>
                    {groupMeta?.name ?? '…'}
                  </Text>
                  <Pressable
                    onPress={() =>
                      conversationId && router.push(`/chat/group/${conversationId}/info` as Href)
                    }
                    style={styles.headerMeetupPillOuter}
                  >
                    <View style={[styles.headerMeetupPill, { paddingVertical: 4 }]}>
                      <Ionicons name="people" size={14} color={colors.primary} />
                      <Text style={styles.headerMeetupPillTxt}>{members.length}</Text>
                    </View>
                  </Pressable>
                </View>
                {groupMeta?.planId ? (
                  <Pressable
                    onPress={() => router.push(`/plan/${groupMeta.planId}` as Href)}
                    style={styles.headerMeetupPillOuter}
                    accessibilityRole="button"
                    accessibilityLabel={`Open plan: ${groupMeta.planTitle ?? 'Plan'}`}
                  >
                    <LinearGradient
                      colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.16)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.headerMeetupPill}
                    >
                      <Ionicons name="sparkles" size={14} color={colors.primary} />
                      <Text style={styles.headerMeetupPillTxt} numberOfLines={1}>
                        {groupMeta.planTitle ?? 'Group plan'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.secondary} />
                    </LinearGradient>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => setSafetySheetOpen(true)}
                style={styles.reportBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Safety"
              >
                <Ionicons name="shield-outline" size={22} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={() =>
                  conversationId && router.push(`/chat/group/${conversationId}/info` as Href)
                }
                style={styles.reportBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Group info"
              >
                <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        {!verifiedUser ? (
          <LinearGradient
            colors={['rgba(255, 193, 7, 0.2)', 'rgba(108, 99, 255, 0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.trustBanner}
          >
            <Ionicons name="information-circle-outline" size={18} color="#B45309" style={{ marginRight: 8 }} />
            <Text style={styles.trustText}>
              Unverified · {UNVERIFIED_DAILY_MESSAGE_CAP} messages/day · no media until verified
            </Text>
          </LinearGradient>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.listFlex}
            data={messages}
            keyExtractor={(m) => m.tempKey ?? m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListFooterComponent={chatListFooter}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onStartReachedThreshold={0.25}
            onStartReached={() => void loadOlder()}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: Math.max(0, info.averageItemLength * info.index),
                animated: true,
              });
              setTimeout(() => {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 120);
            }}
            ListHeaderComponent={
              <>
                {loadingMore ? (
                  <View style={{ paddingVertical: 8 }}>
                    <ActivityIndicator color={colors.textMuted} size="small" />
                  </View>
                ) : null}
                {pinnedPreview ? (
                  <PinnedMessageBanner
                    preview={pinnedPreview.preview}
                    senderLabel={pinnedPreview.senderLabel}
                    onPress={() => scrollToMessage(pinnedPreview.messageId)}
                    onUnpin={() => void runUnpinMessage()}
                  />
                ) : null}
              </>
            }
            renderItem={({ item }) => {
              if (item.is_system) {
                return (
                  <View style={styles.systemRow}>
                    <Text style={styles.systemText}>{messageDisplayText(item)}</Text>
                  </View>
                );
              }
              const mine = item.sender_id === user?.id;
              const { body, media, legacy } = bubblePropsFor(item);
              const onLongPress = item.tempKey || item.is_system ? undefined : () => showMessageActions(item);
              const quotePreview =
                user?.id && item.reply_to_message_id
                  ? resolveReplyQuote(
                      item,
                      messagesById,
                      'Member',
                      user.id,
                      hasMediaForMessage
                    )
                  : null;
              const quote = quotePreview
                ? {
                    senderLabel: quotePreview.senderLabel,
                    preview: quotePreview.preview,
                    isDeleted: quotePreview.isDeleted,
                    onPress: () => scrollToMessage(quotePreview.messageId),
                  }
                : null;
              const senderMember = item.sender_id ? memberByUserId.get(item.sender_id) : null;
              const meta: ChatBubbleMeta | null =
                !item.deleted_at && (body || media || legacy)
                  ? {
                      timeLabel: shortTimeLabel(item.created_at),
                      showSent: mine && !item.tempKey,
                      showRead: false,
                    }
                  : null;
              return (
                <View>
                  {!mine && item.sender_id ? (
                    <Text style={styles.senderName}>
                      {senderDisplayName(item.sender_id, item.group_sender_display)}
                      {senderMember?.is_admin ? (
                        <Text style={styles.adminLabel}> · Admin</Text>
                      ) : null}
                    </Text>
                  ) : null}
                  <ChatBubble
                    body={body}
                    media={media}
                    isMine={mine}
                    legacyImageUrl={legacy}
                    isDeleted={!!item.deleted_at}
                    showEdited={!!item.edited_at && !item.deleted_at}
                    quote={quote}
                    forwarded={!!item.is_forwarded && !item.deleted_at}
                    highlighted={highlightedMessageId === item.id}
                    onLongPress={onLongPress}
                    meta={meta}
                    theme={bubbleTheme}
                  />
                  {item.tempKey && item.sendFailed ? (
                    <ChatBubbleStatus failed onRetry={() => void retryOptimistic(item.tempKey!)} />
                  ) : null}
                </View>
              );
            }}
          />
        )}

        <Animated.View
          style={[
            styles.composerSheet,
            {
              paddingBottom: insets.bottom,
              backgroundColor: chatPreset.composerBg,
              borderTopColor: chatPreset.composerBorder,
            },
            composerLiftStyle,
          ]}
        >
          <ChatComposer
            preset={chatPreset}
            threadLook={messageInputLook}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (conversationId && t.trim().length > 0) signalTyping(conversationId);
            }}
            onSend={() => void sendText()}
            onAttach={() => void pickAndSendMedia()}
            sending={sending}
            attachDisabled={!verifiedUser}
            placeholder="Message…"
            onPlan={() => router.push('/plan/create' as Href)}
            onOffer={onQuickSendOffer}
            onPlace={() => void suggestMeetingArea()}
            replyTo={
              replyTarget
                ? { senderLabel: replyTarget.senderLabel, preview: replyTarget.preview }
                : null
            }
            onCancelReply={() => setReplyTarget(null)}
          />
        </Animated.View>

        {copyAck ? (
          <View style={[styles.copyToast, { bottom: insets.bottom + 88 }]} pointerEvents="none">
            <Text style={styles.copyToastText}>Copied</Text>
          </View>
        ) : null}

        <Modal
          visible={!!editModal}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModal(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.editOverlay}
          >
            <View style={styles.editModalRoot}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditModal(null)} />
              <View
                pointerEvents="box-none"
                style={[StyleSheet.absoluteFill, styles.editBackdropPress]}
              >
                <View style={styles.editSheet}>
                  <Text style={styles.editTitle}>Edit message</Text>
                  <TextInput
                    value={editModal?.draft ?? ''}
                    onChangeText={(t) => setEditModal((e) => (e ? { ...e, draft: t } : e))}
                    style={styles.editInput}
                    multiline
                    autoFocus
                    placeholder="Message"
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.editRow}>
                    <Pressable onPress={() => setEditModal(null)} style={styles.editBtn}>
                      <Text style={styles.editBtnTextMuted}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={() => void saveEditedMessage()} style={styles.editBtn}>
                      <Text style={[styles.editBtnTextMuted, styles.editBtnPrimary]}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <ChatAppearanceSheet
          visible={appearanceSheetOpen}
          onClose={() => setAppearanceSheetOpen(false)}
          value={appearance}
          onSave={(next) => {
            setAppearance(next);
            void saveChatAppearance(next);
          }}
        />

        <MessageActionsSheet
          visible={messageActionItems !== null}
          onClose={() => setMessageActionItems(null)}
          title=""
          actions={messageActionItems ?? []}
        />

        <ForwardMessageSheet
          visible={forwardOpen}
          loading={forwardLoading}
          targets={forwardTargets}
          busyId={forwardBusyId}
          onClose={() => {
            setForwardOpen(false);
            setForwardSource(null);
          }}
          onSelect={(t) => void runForwardTo(t)}
        />

        <MessageDeleteConfirmModal
          visible={deleteConfirm !== null}
          kind={deleteConfirm?.kind ?? 'for_me'}
          isGroupChat
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => {
            if (!deleteConfirm) return;
            if (deleteConfirm.kind === 'for_me') {
              return runDeleteForMe(deleteConfirm.message);
            }
            return runDeleteForEveryone(deleteConfirm.message);
          }}
        />

        <ChatSafetyEntrySheet
          visible={safetySheetOpen}
          onClose={() => setSafetySheetOpen(false)}
          onReportUser={() => {
            if (selectedReportUserId) {
              setReportOpen(true);
              return;
            }
            Alert.alert(
              'Report a member',
              'Open group info and long-press a member to report them, or long-press a message sender.'
            );
          }}
          onPlanDispute={() => {
            if (groupMeta?.planId) router.push(`/dispute/${groupMeta.planId}` as Href);
          }}
          canPlanDispute={!!groupMeta?.planId}
        />

        {user?.id && selectedReportUserId ? (
          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            reporterId={user.id}
            reportedUserId={selectedReportUserId}
            contentType="user"
            contentId={null}
            title="Report member"
          />
        ) : null}

      </SafeAreaView>
  );

  return thread;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  threadBg: { ...StyleSheet.absoluteFillObject },
  wallpaperImage: { resizeMode: 'cover', opacity: 0.88 },
  wallpaperDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.16)' },
  typingBackdrop: { backgroundColor: colors.text },
  headerGradient: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(108, 99, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  back: { padding: 4, width: 36 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  reportBtn: { padding: 4, width: 36, alignItems: 'center', justifyContent: 'center' },
  headerMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  headerNameCol: { flexShrink: 1, maxWidth: '64%', minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerName: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  headerPresenceCap: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  headerMeetupPillOuter: { alignSelf: 'flex-start', marginTop: 6, borderRadius: radius.button, overflow: 'hidden' },
  headerMeetupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  headerMeetupPillTxt: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
    marginHorizontal: spacing.md + 4,
  },
  adminLabel: { color: colors.primary, fontWeight: '700' },
  systemRow: { alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  systemText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(108, 99, 255, 0.1)',
  },
  trustText: { flex: 1, fontSize: 12, color: colors.text, fontWeight: '700', lineHeight: 17 },
  composerSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 2,
    paddingTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  listFlex: { flex: 1 },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editOverlay: { flex: 1 },
  editModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  editBackdropPress: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  editSheet: {
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  editTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  editInput: {
    minHeight: 88,
    maxHeight: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  editRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  editBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  editBtnTextMuted: { fontSize: 16, color: colors.textMuted, fontWeight: '600' },
  editBtnPrimary: { color: colors.primary },
  copyToast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 29, 38, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  copyToastText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
