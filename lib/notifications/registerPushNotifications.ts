/**
 * Expo push registration — store token in profile for server / webhooks (FCM/APNs via Expo).
 * Push copy must stay generic (no escrow amounts or KYC details in title/body).
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const existing = await Notifications.getPermissionsAsync();
  let ok = permissionsGranted(existing);
  if (!ok) {
    const next = await Notifications.requestPermissionsAsync();
    ok = permissionsGranted(next);
  }
  if (!ok) return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId: String(projectId) } : undefined
    );
    return token.data;
  } catch {
    if (__DEV__) console.warn('[push] getExpoPushTokenAsync failed — set EAS projectId in app.json when using builds.');
    return null;
  }
}

export async function persistExpoPushToken(userId: string, token: string | null): Promise<void> {
  if (!token || !isSupabaseConfigured) return;
  const { data: profile } = await supabase.from('profiles').select('preferences').eq('user_id', userId).maybeSingle();
  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
  await supabase
    .from('profiles')
    .update({
      preferences: {
        ...prefs,
        expo_push_token: token,
        expo_push_token_updated_at: new Date().toISOString(),
      },
    })
    .eq('user_id', userId);
}
