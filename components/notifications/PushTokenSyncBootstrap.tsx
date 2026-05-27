/**
 * Registers Expo push token as soon as the user is signed in (no onboarding gate).
 */
import { useAuth } from '@/contexts/AuthContext';
import { syncExpoPushTokenForUser } from '@/lib/notifications/registerPushNotifications';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function PushTokenSyncBootstrap() {
  const { user, profile, loading: authLoading } = useAuth();
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id || !isSupabaseConfigured) return;

    const pushOn = profile?.preferences?.notifications?.push !== false;

    void (async () => {
      const result = await syncExpoPushTokenForUser(user.id, pushOn);
      if (result.token) lastTokenRef.current = result.token;
      if (__DEV__ && result.error) {
        console.warn('[push] sync:', result.error, result.persisted ? 'saved' : 'not saved');
      }
    })();
  }, [authLoading, user?.id, profile, profile?.preferences?.notifications?.push]);

  useEffect(() => {
    if (!user?.id) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const pushOn = profile?.preferences?.notifications?.push !== false;
      void syncExpoPushTokenForUser(user.id, pushOn);
    });
    return () => sub.remove();
  }, [user?.id, profile?.preferences?.notifications?.push]);

  return null;
}
