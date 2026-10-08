import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string) => `matchmaker_interests_last_opened_at:${userId}`;

export async function getMatchMakerInterestQueueLastOpenedAt(
  userId: string
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

const refreshListeners = new Set<() => void>();

export function subscribeMatchMakerInterestBadgeRefresh(listener: () => void): () => void {
  refreshListeners.add(listener);
  return () => refreshListeners.delete(listener);
}

export async function markMatchMakerInterestQueueOpened(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), new Date().toISOString());
    refreshListeners.forEach((listener) => listener());
  } catch {
    /* non-fatal */
  }
}
