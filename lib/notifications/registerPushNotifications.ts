/**
 * Expo push registration — store token in profile for server / webhooks (FCM/APNs via Expo).
 * Push copy must stay generic (no escrow amounts or KYC details in title/body).
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ANDROID_CHANNEL_ID = 'linkup-default';

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'LinkUp',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 120, 80, 120],
    lightColor: '#6C63FF',
  });
}

function permissionsGranted(r: Notifications.NotificationPermissionsStatus): boolean {
  const o = r as unknown as { granted?: boolean; status?: string };
  return o.granted === true || o.status === 'granted';
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegistrationResult = {
  token: string | null;
  permissionGranted: boolean;
  error?: string;
};

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { token: null, permissionGranted: false, error: 'web' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let ok = permissionsGranted(existing);
  if (!ok) {
    const next = await Notifications.requestPermissionsAsync();
    ok = permissionsGranted(next);
  }
  if (!ok) {
    return { token: null, permissionGranted: false, error: 'permission_denied' };
  }

  try {
    await ensureAndroidNotificationChannel();
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;
    if (!projectId && __DEV__) {
      console.warn('[push] Missing extra.eas.projectId in app.json — token may fail on device builds.');
    }
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId: String(projectId) } : undefined
    );
    return { token: token.data, permissionGranted: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (__DEV__) console.warn('[push] getExpoPushTokenAsync failed:', msg);
    return { token: null, permissionGranted: true, error: msg };
  }
}

export async function persistExpoPushToken(
  userId: string,
  token: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!token || !isSupabaseConfigured) return { ok: false, error: 'no_token' };
  const updatedAt = new Date().toISOString();
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences, expo_push_token')
    .eq('user_id', userId)
    .maybeSingle();
  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from('profiles')
    .update({
      preferences: {
        ...prefs,
        expo_push_token: token,
        expo_push_token_updated_at: updatedAt,
      },
      expo_push_token: token,
      expo_push_token_updated_at: updatedAt,
    })
    .eq('user_id', userId);
  if (error) {
    if (__DEV__) console.warn('[push] persist token failed:', error.message);
    return { ok: false, error: error.message };
  }
  if (__DEV__) console.info('[push] token saved for user', userId.slice(0, 8));
  return { ok: true };
}

/** Request permission, obtain Expo token, persist to profile (when push pref is on). */
export async function syncExpoPushTokenForUser(
  userId: string,
  pushEnabled: boolean
): Promise<PushRegistrationResult & { persisted: boolean }> {
  if (!pushEnabled) {
    return { token: null, permissionGranted: false, persisted: false, error: 'push_disabled' };
  }
  const reg = await registerForPushNotificationsAsync();
  if (!reg.token) {
    return { ...reg, persisted: false };
  }
  const save = await persistExpoPushToken(userId, reg.token);
  return { ...reg, persisted: save.ok, error: save.error ?? reg.error };
}
