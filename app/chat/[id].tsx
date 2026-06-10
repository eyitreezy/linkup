/**
 * M2 — Chat thread: bubbles, media, realtime, trust caps, optimistic send.
 */
import { ChatAppearanceSheet } from '@/components/messages/ChatAppearanceSheet';
import { ChatBubble, ChatBubbleStatus, type ChatBubbleMeta } from '@/components/messages/ChatBubble';
import type { ChatBubbleMedia } from '@/components/messages/ChatBubble';
import {
  MessageActionsSheet,
  type MessageActionItem,
} from '@/components/messages/MessageActionsSheet';
import { ChatComposer } from '@/components/messages/ChatComposer';
import { ChatTypingIndicator } from '@/components/presence/ChatTypingIndicator';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { colors, radius, spacing } from '@/constants/theme';
import { useKeyboardAnimation } from '@/hooks/useKeyboardAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import { usePresenceActions } from '@/contexts/PresenceContext';
import { useAuth } from '@/contexts/AuthContext';
import { derivePresenceUi } from '@/lib/presence/derivePresenceUi';
import { fetchUserPresence, subscribeUserPresenceRealtime } from '@/lib/presence/subscribeUserPresenceRealtime';
import { TYPING_STALE_MS } from '@/lib/presence/presenceConstants';
import { getVisibilityPrefs, typingVisibleToViewer } from '@/lib/presence/visibilityPrefs';
import { moderateMessageText } from '@/lib/ai';
import {
  CHAT_PAGE_SIZE,
  fetchMessagesOlderThan,
  messageDisplayText,
  mimeToMediaKind,
  normalizeChatMessageRow,
  parseLegacyImageBody,
  runMessageSelect,
  type ChatMessageRow,
  type ChatMediaRow,
} from '@/lib/messaging/chatQueries';
import { fetchActiveMeetupWithPeer, type LinkedMeetup } from '@/lib/messaging/fetchActiveMeetupWithPeer';
import {
  detectOffPlatformContact,
  pairContactShareUnlocked,
} from '@/lib/messaging/contactSharePolicy';
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
import { subscribeThreadMessagesRealtime } from '@/lib/messaging/subscribeThreadMessagesRealtime';
import { ChatSafetyEntrySheet } from '@/components/trust/ChatSafetyEntrySheet';
import { ContactShareBlockedModal } from '@/components/trust/ContactShareBlockedModal';
import { ReportSheet } from '@/components/trust/ReportSheet';
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
import type { DbUserPresence, ProfilePreferences } from '@/types/database';

const MAX_VIDEO_BYTES = 14 * 1024 * 1024;

/** WhatsApp-style edit window */
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Longer window for delete-for-everyone */
const MESSAGE_DELETE_FOR_EVERYONE_MS = 48 * 60 * 60 * 1000;

function withinMsSince(iso: string, ms: number): boolean {
  return Date.now() - new Date(iso).getTime() <= ms;
}

function shortTimeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

type UiMessage = ChatMessageRow & { tempKey?: string; sendFailed?: boolean };

type EditModalState = { messageId: string; draft: string } | null;

export default function ChatThreadScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { composerLiftStyle, chatListFooterStyle, typingBackdropStyle } = useKeyboardAnimation();
  const { user, dbUser, profile } = useAuth();
  const { signalTyping, clearTyping } = usePresenceActions();
  const [peer, setPeer] = useState<{
    id: string;
    name: string;
    avatarUrl: string | null;
    verified: boolean;
    preferences?: ProfilePreferences;
  } | null>(null);
  const [peerPresence, setPeerPresence] = useState<DbUserPresence | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const peerPresenceRef = useRef<DbUserPresence | null>(null);
  const [linkedMeetup, setLinkedMeetup] = useState<LinkedMeetup | null>(null);
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
  const [reportOpen, setReportOpen] = useState(false);
  const [safetySheetOpen, setSafetySheetOpen] = useState(false);
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

  const headerPresence = useMemo(
    () => derivePresenceUi(profile, peer?.preferences, peerPresence),
    [profile, peer?.preferences, peerPresence]
  );

  const canOpenPlanDispute = useMemo(
    () =>
      !!linkedMeetup &&
      ['agreed', 'awaiting_payment', 'active', 'completed'].includes(linkedMeetup.status),
    [linkedMeetup]
  );

  const showTypingIndicator = peerTyping && typingVisibleToViewer(profile, peer?.preferences);

  const readReceiptsOn = getVisibilityPrefs(profile).read_receipts;

  /** Approximate “read” when the peer has any later message (common 1:1 heuristic; no server read cursor). */
  const approxReadByMessageId = useMemo(() => {
    if (!user?.id) return new Map<string, boolean>();
    let latestPeerMs = 0;
    for (const m of messages) {
      if (m.tempKey || m.sender_id === user.id) continue;
      latestPeerMs = Math.max(latestPeerMs, new Date(m.created_at).getTime());
    }
    const map = new Map<string, boolean>();
    for (const m of messages) {
      if (m.tempKey || m.sender_id !== user.id) continue;
      const t = new Date(m.created_at).getTime();
      map.set(m.id, latestPeerMs > t);
    }
    return map;
  }, [messages, user?.id]);

  useEffect(() => {
    peerPresenceRef.current = peerPresence;
  }, [peerPresence]);

  useEffect(() => {
    const id = setInterval(() => {
      const row = peerPresenceRef.current;
      if (!row || !conversationId) {
        setPeerTyping(false);
        return;
      }
      const typing =
        row.typing_conversation_id === conversationId &&
        !!row.typing_updated_at &&
        Date.now() - new Date(row.typing_updated_at).getTime() < TYPING_STALE_MS;
      setPeerTyping(typing);
    }, 600);
    return () => clearInterval(id);
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
      const { messages: chunk, mediaByMessageId } = await fetchMessagesOlderThan(conversationId, undefined, CHAT_PAGE_SIZE);
      setMessages(chunk);
      setMediaById(mediaByMessageId);
      await hydrateSigned(mediaByMessageId);
      setHasMore(chunk.length >= CHAT_PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [conversationId, hydrateSigned]);

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
        return merged.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });
      if (older.length < CHAT_PAGE_SIZE) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, messages, hydrateSigned]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!conversationId || !user || !isSupabaseConfigured) return;
    (async () => {
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('user_a, user_b')
        .eq('id', conversationId)
        .maybeSingle();
      if (error || !conv) return;
      const other = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, verified_badge, preferences')
        .eq('user_id', other)
        .maybeSingle();
      setPeer({
        id: other,
        name: prof?.display_name ?? 'User',
        avatarUrl: prof?.avatar_url ?? null,
        verified: !!prof?.verified_badge,
        preferences: prof?.preferences as ProfilePreferences | undefined,
      });
    })();
  }, [conversationId, user]);

  useEffect(() => {
    if (!user?.id || !peer?.id || !isSupabaseConfigured) {
      setLinkedMeetup(null);
      return;
    }
    let cancelled = false;
    void fetchActiveMeetupWithPeer(user.id, peer.id).then((m) => {
      if (!cancelled) setLinkedMeetup(m);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, peer?.id]);

  useEffect(() => {
    if (!peer?.id || !isSupabaseConfigured) {
      setPeerPresence(null);
      return;
    }

    let cancelled = false;
    void fetchUserPresence(peer.id).then((row) => {
      if (!cancelled) setPeerPresence(row);
    });

    const unsubscribe = subscribeUserPresenceRealtime(peer.id, (row) => {
      if (!cancelled) setPeerPresence(row);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [peer?.id]);

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
        setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        if (row.deleted_at || !row.media_id) {
          setMediaById((p) => {
            if (!p[row.id]) return p;
            const next = { ...p };
            delete next[row.id];
            return next;
          });
        }
        if (!row.media_id) return;
        const { data: byFk } = await supabase
          .from('media')
          .select('parent_id, mime_type, storage_bucket, storage_path')
          .eq('id', row.media_id)
          .maybeSingle();
        if (byFk) {
          const r: ChatMediaRow = {
            parent_id: row.id,
            mime_type: byFk.mime_type as string | null,
            storage_bucket: byFk.storage_bucket as string,
            storage_path: byFk.storage_path as string,
          };
          setMediaById((p) => ({ ...p, [row.id]: r }));
          await hydrateSignedRef.current({ [row.id]: r });
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

  const assertOutgoingContactAllowed = useCallback(
    async (snippet: string) => {
      if (!peer?.id) return true;
      const unlocked = await pairContactShareUnlocked(supabase, peer.id);
      if (unlocked) return true;
      if (!detectOffPlatformContact(snippet)) return true;
      contactBlockFromSendRef.current = true;
      setContactBlockedOpen(true);
      return false;
    },
    [peer?.id]
  );

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
      reply_to_message_id: null,
    };
    setMessages((p) => [...p, optimistic]);
    setText('');
    setSending(true);

    const { data, error } = await runMessageSelect((cols) =>
      supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: body,
          moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
        })
        .select(cols)
        .single()
    );

    setSending(false);

    if (error) {
      setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: true } : m)));
      Alert.alert('Could not send', error.message);
      return;
    }

    const sentRow = normalizeChatMessageRow(data as Record<string, unknown>);

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
      const { data, error } = await runMessageSelect((cols) =>
        supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            text: snippet,
            moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
          })
          .select(cols)
          .single()
      );
      if (error) {
        setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: true } : m)));
        Alert.alert('Could not send', error.message);
        return;
      }
      const sentRow = normalizeChatMessageRow(data as Record<string, unknown>);
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

  const softDeleteForEveryone = useCallback(async (messageId: string) => {
    const { data, error } = await runMessageSelect((cols) =>
      supabase
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
          text: null,
          body: null,
          media_id: null,
        })
        .eq('id', messageId)
        .select(cols)
        .single()
    );
    if (error) {
      Alert.alert('Could not delete', error.message);
      return;
    }
    if (data) {
      const row = normalizeChatMessageRow(data as Record<string, unknown>);
      setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
      setMediaById((p) => {
        if (!p[messageId]) return p;
        const next = { ...p };
        delete next[messageId];
        return next;
      });
    }
  }, []);

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
    const { data, error } = await runMessageSelect((cols) =>
      supabase
        .from('messages')
        .update({
          text: body,
          edited_at: new Date().toISOString(),
          moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
        })
        .eq('id', editModal.messageId)
        .select(cols)
        .single()
    );
    if (error) {
      Alert.alert('Could not update', error.message);
      return;
    }
    setEditModal(null);
    if (data) {
      void persistModerationAfterSend({
        contentType: 'message',
        contentId: editModal.messageId,
        textSample: body,
      });
      const row = normalizeChatMessageRow(data as Record<string, unknown>);
      setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
    }
  }, [editModal, user, conversationId, assertOutgoingContactAllowed]);

  const showMessageActions = useCallback(
    (m: UiMessage) => {
      if (m.tempKey || !user) return;
      const mine = m.sender_id === user.id;
      const isDel = !!m.deleted_at;
      const rawText = messageDisplayText(m)?.trim() ?? '';
      const canCopy = !isDel && rawText.length > 0;
      const canEdit =
        mine &&
        !isDel &&
        withinMsSince(m.created_at, MESSAGE_EDIT_WINDOW_MS) &&
        rawText.length > 0;
      const canDeleteEveryone =
        mine && !isDel && withinMsSince(m.created_at, MESSAGE_DELETE_FOR_EVERYONE_MS);

      const runCopy = () => void Clipboard.setStringAsync(rawText);
      const runEdit = () => setEditModal({ messageId: m.id, draft: rawText });
      const runDelete = () =>
        Alert.alert('Delete for everyone?', 'This removes the message for you and the other person.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void softDeleteForEveryone(m.id) },
        ]);

      const items: MessageActionItem[] = [];
      if (canCopy) items.push({ key: 'copy', label: 'Copy text', icon: 'copy-outline', onPress: runCopy });
      if (canEdit) items.push({ key: 'edit', label: 'Edit', icon: 'create-outline', onPress: runEdit });
      if (canDeleteEveryone)
        items.push({
          key: 'delete',
          label: 'Delete for everyone',
          icon: 'trash-outline',
          destructive: true,
          onPress: runDelete,
        });

      if (items.length === 0) return;
      setMessageActionItems(items);
    },
    [user, softDeleteForEveryone]
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
      const { data: inserted, error: insErr } = await runMessageSelect((cols) =>
        supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            text: caption,
            moderation_status: 'pending',
          })
          .select(cols)
          .single()
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
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } finally {
      setSending(false);
    }
  }, [user, conversationId, text, verifiedUser, clearTyping, dbUser?.account_status, assertOutgoingContactAllowed]);

  const onQuickSendOffer = useCallback(() => {
    if (linkedMeetup) {
      router.push(`/plan/${linkedMeetup.id}` as Href);
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
  }, [linkedMeetup]);

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
              onPress={() => peer?.id && router.push(`/user/${peer.id}` as Href)}
              disabled={!peer?.id}
              accessibilityRole="button"
              accessibilityLabel="View profile"
            >
              <AvatarWithPresence
                uri={peer?.avatarUrl}
                name={peer?.name}
                size={44}
                presence={headerPresence}
                showDot
              />
              <View style={styles.headerNameCol}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerName} numberOfLines={1}>
                    {peer?.name ?? '…'}
                  </Text>
                  {peer?.verified ? (
                    <Ionicons name="checkmark-circle" size={17} color={colors.primary} style={{ marginLeft: 4 }} />
                  ) : null}
                </View>
                {linkedMeetup ? (
                  <Pressable
                    onPress={() => router.push(`/plan/${linkedMeetup.id}` as Href)}
                    style={styles.headerMeetupPillOuter}
                    accessibilityRole="button"
                    accessibilityLabel={`Open meetup: ${linkedMeetup.title}`}
                  >
                    <LinearGradient
                      colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.16)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.headerMeetupPill}
                    >
                      <Ionicons name="sparkles" size={14} color={colors.primary} />
                      <Text style={styles.headerMeetupPillTxt} numberOfLines={1}>
                        {linkedMeetup.title}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.secondary} />
                    </LinearGradient>
                  </Pressable>
                ) : headerPresence.caption ? (
                  <Text style={styles.headerPresenceCap} numberOfLines={1}>
                    {headerPresence.caption}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            {peer?.id && user?.id !== peer.id ? (
              <View style={styles.headerRight}>
                <Pressable
                  onPress={() => setAppearanceSheetOpen(true)}
                  style={styles.reportBtn}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Chat appearance"
                >
                  <Ionicons name="color-palette-outline" size={22} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => setSafetySheetOpen(true)}
                  style={styles.reportBtn}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Safety and report"
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <View style={{ width: 32 }} />
            )}
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
            ListHeaderComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 8 }}>
                  <ActivityIndicator color={colors.textMuted} size="small" />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              const { body, media, legacy } = bubblePropsFor(item);
              const onLongPress = item.tempKey ? undefined : () => showMessageActions(item);
              const meta: ChatBubbleMeta | null =
                !item.deleted_at && (body || media || legacy)
                  ? {
                      timeLabel: shortTimeLabel(item.created_at),
                      showSent: mine && !item.tempKey,
                      showRead:
                        mine &&
                        !item.tempKey &&
                        readReceiptsOn &&
                        (approxReadByMessageId.get(item.id) ?? false),
                    }
                  : null;
              return (
                <View>
                  <ChatBubble
                    body={body}
                    media={media}
                    isMine={mine}
                    legacyImageUrl={legacy}
                    isDeleted={!!item.deleted_at}
                    showEdited={!!item.edited_at && !item.deleted_at}
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

        <ChatTypingIndicator visible={showTypingIndicator} peerName={peer?.name ?? undefined} />

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
          />
        </Animated.View>

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

        {user?.id && peer?.id ? (
          <ChatSafetyEntrySheet
            visible={safetySheetOpen}
            onClose={() => setSafetySheetOpen(false)}
            onReportUser={() => setReportOpen(true)}
            onPlanDispute={() => {
              if (linkedMeetup) router.push(`/dispute/${linkedMeetup.id}` as Href);
            }}
            canPlanDispute={canOpenPlanDispute}
          />
        ) : null}

        <ContactShareBlockedModal visible={contactBlockedOpen} onDismiss={() => void dismissContactBlockedModal()} />

        {user?.id && peer?.id ? (
          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            reporterId={user.id}
            reportedUserId={peer.id}
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
});
