/**
 * Lightweight last-read timestamps for unread dots (client-only; replace with server read receipts later).
 */
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

export async function setConversationLastRead(conversationId: string, iso: string): Promise<void> {
  const map = await getLastReadMap();
  map[conversationId] = iso;
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}
