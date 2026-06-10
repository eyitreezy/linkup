/**
 * Last-read timestamps for unread dots — local cache + server read cursor.
 */
import { markConversationRead } from '@/lib/messaging/conversationReads';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@linkup/inbox_last_read_v1';

export async function getLastReadMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function setConversationLastRead(
  conversationId: string,
  iso: string,
  messageId?: string | null
): Promise<void> {
  const map = await getLastReadMap();
  const prev = map[conversationId];
  if (!prev || new Date(iso) > new Date(prev)) {
    map[conversationId] = iso;
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  }
  void markConversationRead(conversationId, messageId ?? null);
}
