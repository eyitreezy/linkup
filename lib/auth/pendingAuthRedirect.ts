import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';

const STORAGE_KEY = 'linkup_pending_auth_redirect_v1';

/** Persist a post-login destination (e.g. /plan/{id}). */
export async function setPendingAuthRedirect(path: string): Promise<void> {
  const normalized = path.trim();
  if (!normalized.startsWith('/')) return;
  await AsyncStorage.setItem(STORAGE_KEY, normalized);
}

export async function peekPendingAuthRedirect(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw?.startsWith('/')) return null;
  return raw;
}

export async function consumePendingAuthRedirect(): Promise<string | null> {
  const raw = await peekPendingAuthRedirect();
  if (!raw) return null;
  await AsyncStorage.removeItem(STORAGE_KEY);
  return raw;
}

export function isSafeInAppRedirect(path: string | null | undefined): path is string {
  if (!path?.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('..')) return false;
  return true;
}

export function redirectPathToHref(path: string): Href {
  return path as Href;
}
