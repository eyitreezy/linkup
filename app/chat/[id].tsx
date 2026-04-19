/**
 * M2 — Chat thread: bubbles, media, realtime, trust caps, optimistic send.
 */
import { ChatBubble, ChatBubbleStatus } from '@/components/messages/ChatBubble';
import type { ChatBubbleMedia } from '@/components/messages/ChatBubble';
import {
  MessageActionsSheet,
  type MessageActionItem,
} from '@/components/messages/MessageActionsSheet';
import { MessageInput } from '@/components/messages/MessageInput';
import { ChatTypingIndicator } from '@/components/presence/ChatTypingIndicator';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { colors, spacing } from '@/constants/theme';
import { usePresenceActions } from '@/contexts/PresenceContext';
import { useAuth } from '@/contexts/AuthContext';
import { derivePresenceUi } from '@/lib/presence/derivePresenceUi';
import { TYPING_STALE_MS } from '@/lib/presence/presenceConstants';
import { typingVisibleToViewer } from '@/lib/presence/visibilityPrefs';
import { moderateMessageText } from '@/lib/ai';
import {
  CHAT_MESSAGE_COLUMNS,
  CHAT_PAGE_SIZE,
  fetchMessagesOlderThan,
  messageDisplayText,
  mimeToMediaKind,
  parseLegacyImageBody,
  type ChatMessageRow,
  type ChatMediaRow,
} from '@/lib/messaging/chatQueries';
import { setConversationLastRead } from '@/lib/messaging/inboxCache';
import { logModerationResult } from '@/lib/messaging/moderationLog';
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
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DbUserPresence, ProfilePreferences } from '@/types/database';

const MAX_VIDEO_BYTES = 14 * 1024 * 1024;

/** WhatsApp-style edit window */
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Longer window for delete-for-everyone */
const MESSAGE_DELETE_FOR_EVERYONE_MS = 48 * 60 * 60 * 1000;

function withinMsSince(iso: string, ms: number): boolean {
  return Date.now() - new Date(iso).getTime() <= ms;
}

type UiMessage = ChatMessageRow & { tempKey?: string; sendFailed?: boolean };

type EditModalState = { messageId: string; draft: string } | null;

export default function ChatThreadScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
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
  const listRef = useRef<FlatList<UiMessage>>(null);
  const verifiedUser = isMessagingFullyVerified(dbUser?.verification_status);

  const headerPresence = useMemo(
    () => derivePresenceUi(profile, peer?.preferences, peerPresence),
    [profile, peer?.preferences, peerPresence]
  );

  const showTypingIndicator = peerTyping && typingVisibleToViewer(profile, peer?.preferences);

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
    if (!peer?.id || !isSupabaseConfigured) {
      setPeerPresence(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('user_presence').select('*').eq('user_id', peer.id).maybeSingle();
      if (!cancelled && data) setPeerPresence(data as DbUserPresence);
    })();
    const ch = supabase
      .channel(`presence:${peer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${peer.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as DbUserPresence;
          setPeerPresence(row);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [peer?.id]);

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const row = payload.new as ChatMessageRow;
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
            await hydrateSigned({ [row.id]: r });
          }
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const row = payload.new as ChatMessageRow;
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
            await hydrateSigned({ [row.id]: r });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const id = (payload.old as { id?: string })?.id;
          if (!id) return;
          setMessages((prev) => prev.filter((m) => m.id !== id));
          setMediaById((p) => {
            if (!p[id]) return p;
            const next = { ...p };
            delete next[id];
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, hydrateSigned]);

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

  const sendText = useCallback(async () => {
    if (!user || !conversationId || !text.trim() || sending) return;

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
    clearTyping();
    const mod = await moderateMessageText(body);
    logModerationResult(
      {
        conversationId,
        senderId: user.id,
        textSnippet: body,
        status: mod.status,
        reason: mod.reason,
      },
      supabase
    );

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
    };
    setMessages((p) => [...p, optimistic]);
    setText('');
    setSending(true);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        text: body,
        moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
      })
      .select(CHAT_MESSAGE_COLUMNS)
      .single();

    setSending(false);

    if (error) {
      setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: true } : m)));
      Alert.alert('Could not send', error.message);
      return;
    }

    setMessages((p) => {
      const without = p.filter((m) => m.tempKey !== tempKey);
      const row = data as ChatMessageRow;
      if (without.some((m) => m.id === row.id)) return without;
      return [...without, row];
    });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [user, conversationId, text, sending, verifiedUser, countTodaySends, clearTyping]);

  const retryOptimistic = useCallback(
    async (tempKey: string) => {
      const msg = messages.find((m) => m.tempKey === tempKey);
      if (!msg || !user || !conversationId) return;
      setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: false } : m)));
      const snippet = messageDisplayText(msg) ?? '';
      const mod = await moderateMessageText(snippet);
      logModerationResult(
        {
          conversationId,
          senderId: user.id,
          textSnippet: snippet,
          status: mod.status,
          reason: mod.reason,
        },
        supabase
      );
      if (mod.status === 'blocked') {
        Alert.alert('Message blocked', mod.reason ?? 'Policy violation');
        setMessages((p) => p.filter((m) => m.tempKey !== tempKey));
        return;
      }
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: snippet,
          moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
        })
        .select(CHAT_MESSAGE_COLUMNS)
        .single();
      if (error) {
        setMessages((p) => p.map((m) => (m.tempKey === tempKey ? { ...m, sendFailed: true } : m)));
        Alert.alert('Could not send', error.message);
        return;
      }
      setMessages((p) => {
        const without = p.filter((m) => m.tempKey !== tempKey);
        const row = data as ChatMessageRow;
        if (without.some((m) => m.id === row.id)) return without;
        return [...without, row];
      });
    },
    [messages, user, conversationId]
  );

  const softDeleteForEveryone = useCallback(async (messageId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        text: null,
        body: null,
        media_id: null,
      })
      .eq('id', messageId)
      .select(CHAT_MESSAGE_COLUMNS)
      .single();
    if (error) {
      Alert.alert('Could not delete', error.message);
      return;
    }
    if (data) {
      const row = data as ChatMessageRow;
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
    const mod = await moderateMessageText(body);
    logModerationResult(
      {
        conversationId,
        senderId: user.id,
        textSnippet: body,
        status: mod.status,
        reason: mod.reason,
      },
      supabase
    );
    if (mod.status === 'blocked') {
      Alert.alert('Message blocked', mod.reason ?? 'Policy violation');
      return;
    }
    if (mod.status === 'flagged') {
      Alert.alert('Heads up', 'This message may be reviewed under our safety policies.');
    }
    const { data, error } = await supabase
      .from('messages')
      .update({
        text: body,
        edited_at: new Date().toISOString(),
        moderation_status: mod.status === 'flagged' ? 'flagged' : 'clean',
      })
      .eq('id', editModal.messageId)
      .select(CHAT_MESSAGE_COLUMNS)
      .single();
    if (error) {
      Alert.alert('Could not update', error.message);
      return;
    }
    setEditModal(null);
    if (data) {
      const row = data as ChatMessageRow;
      setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
    }
  }, [editModal, user, conversationId]);

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
      const { data: inserted, error: insErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: caption,
          moderation_status: 'pending',
        })
        .select(CHAT_MESSAGE_COLUMNS)
        .single();

      if (insErr || !inserted) {
        Alert.alert('Error', insErr?.message ?? 'Could not create message');
        return;
      }

      const msgId = inserted.id;
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

      const finalized: ChatMessageRow = { ...(inserted as ChatMessageRow), media_id: medRow.id };

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
      clearTyping();
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } finally {
      setSending(false);
    }
  }, [user, conversationId, text, verifiedUser, clearTyping]);

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
    <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, { paddingTop: spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.headerMid}>
            <AvatarWithPresence
              uri={peer?.avatarUrl}
              name={peer?.name}
              size={36}
              presence={headerPresence}
              showDot
            />
            <View style={styles.headerNameCol}>
              <Text style={styles.headerName} numberOfLines={1}>
                {peer?.name ?? '…'}
              </Text>
              {headerPresence.caption ? (
                <Text style={styles.headerPresenceCap} numberOfLines={1}>
                  {headerPresence.caption}
                </Text>
              ) : null}
            </View>
            {peer?.verified ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginLeft: 4 }} />
            ) : null}
          </View>
          <View style={{ width: 32 }} />
        </View>

        {!verifiedUser ? (
          <View style={styles.trustBanner}>
            <Text style={styles.trustText}>
              Unverified · {UNVERIFIED_DAILY_MESSAGE_CAP} messages/day · no media until verified
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.tempKey ?? m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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

        <MessageInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (conversationId && t.trim().length > 0) signalTyping(conversationId);
          }}
          onSend={() => void sendText()}
          onAttach={() => void pickAndSendMedia()}
          sending={sending}
          attachDisabled={!verifiedUser}
        />

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

        <MessageActionsSheet
          visible={messageActionItems !== null}
          onClose={() => setMessageActionItems(null)}
          title=""
          actions={messageActionItems ?? []}
        />
      </SafeAreaView>
  );

  return Platform.OS === 'ios' ? (
    <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={88}>
      {thread}
    </KeyboardAvoidingView>
  ) : (
    thread
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  back: { padding: 4, width: 36 },
  headerMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  headerNameCol: { flexShrink: 1, maxWidth: '56%', minWidth: 0 },
  headerName: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerPresenceCap: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  trustBanner: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  trustText: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  list: { padding: spacing.md, paddingBottom: spacing.lg },
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
