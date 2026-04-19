/**
 * Notification inbox: list, unread count, Realtime, optional push registration.
 */
import { useAuth } from '@/contexts/AuthContext';
import { navigateFromNotification } from '@/lib/notifications/navigateFromNotification';
import {
  persistExpoPushToken,
  registerForPushNotificationsAsync,
} from '@/lib/notifications/registerPushNotifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbNotification, NotificationPayload } from '@/types/database';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, Vibration } from 'react-native';

type Ctx = {
  notifications: DbNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const NotificationInboxCtx = createContext<Ctx | undefined>(undefined);

function profileOnboardingDone(p: { onboarding_status?: string } | null | undefined): boolean {
  return !!p && p.onboarding_status !== 'pending';
}

export function NotificationInboxProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      if (__DEV__) console.warn('[notifications]', error.message);
      return;
    }
    setNotifications((data ?? []) as DbNotification[]);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`inbox-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && (Platform.OS === 'ios' || Platform.OS === 'android')) {
            Vibration.vibrate(12);
          }
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;
    const pushOn = profile?.preferences?.notifications?.push !== false;
    if (!pushOn) return;
    let cancelled = false;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!cancelled && token) await persistExpoPushToken(user.id, token);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.preferences?.notifications?.push]);

  /** Drop stale “last opened from notification” state once auth is resolved and the user is signed out — avoids routing to /notifications after a fresh sign-in. */
  useEffect(() => {
    if (authLoading) return;
    if (user?.id) return;
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      /* unavailable on some platforms / web */
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!user?.id || !profileOnboardingDone(profile)) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const raw = response.notification.request.content.data;
      navigateFromNotification(router, raw as NotificationPayload);
    });

    return () => sub.remove();
  }, [user?.id, profile?.onboarding_status]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const markRead = useCallback(
    async (id: string) => {
      if (!user?.id || !isSupabaseConfigured) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id);
      if (error) void refresh();
    },
    [user?.id, refresh]
  );

  const markAllRead = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (error) void refresh();
  }, [user?.id, refresh]);

  const remove = useCallback(
    async (id: string) => {
      if (!user?.id || !isSupabaseConfigured) return;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id);
      if (error) void refresh();
    },
    [user?.id, refresh]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
      remove,
    }),
    [notifications, unreadCount, loading, refresh, markRead, markAllRead, remove]
  );

  return <NotificationInboxCtx.Provider value={value}>{children}</NotificationInboxCtx.Provider>;
}

export function useNotificationInbox() {
  const v = useContext(NotificationInboxCtx);
  if (!v) throw new Error('useNotificationInbox inside NotificationInboxProvider');
  return v;
}

/** Optional: use where provider wraps only part of tree — returns null if outside provider. */
export function useNotificationInboxOptional(): Ctx | null {
  return useContext(NotificationInboxCtx) ?? null;
}
