import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoPushTicket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
};

/**
 * Load Expo push token from profile.preferences and POST to Expo Push API.
 * Respects preferences.notifications.push === false.
 * Never include sensitive amounts or PII in title/body.
 */
export async function sendExpoPushIfAllowed(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  const { data: row, error } = await supabase
    .from('profiles')
    .select('preferences, expo_push_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[expo-push] profile load', userId, error.message);
    return;
  }
  const prefs = (row?.preferences ?? {}) as {
    notifications?: { push?: boolean };
    expo_push_token?: string;
  };
  if (prefs.notifications?.push === false) {
    return;
  }
  const token =
    (typeof row?.expo_push_token === 'string' ? row.expo_push_token : null) ?? prefs.expo_push_token;
  if (!token || !token.startsWith('ExponentPushToken')) {
    return;
  }

  const payload = {
    to: token,
    title,
    body,
    data: { ...data, type: data.type },
    sound: 'default',
    priority: 'high',
  };

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ExpoPushResponse;
    const ticket = json.data?.[0];
    if (!res.ok || ticket?.status === 'error') {
      console.warn('[expo-push] ticket', userId, ticket?.message ?? ticket?.details?.error ?? res.status);
    }
  } catch (e) {
    console.warn('[expo-push] fetch failed', userId, e);
  }
}
