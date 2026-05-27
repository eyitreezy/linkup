/**
 * Auth + profile bootstrap — Supabase session and public.users row.
 */
import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { captureAuthLinkIfPresent, peekPendingAuthUrl } from '@/lib/auth/pendingAuthUrl';
import { clearStaleAuthSession, getSessionRecoveringStale } from '@/lib/auth/sessionRecovery';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import type { DbProfile, DbUser } from '@/types/database';

type AuthCtx = {
  session: Session | null;
  user: User | null;
  dbUser: DbUser | null;
  profile: DbProfile | null;
  loading: boolean;
  isAdmin: boolean;
  /** `public.admins.id` when the signed-in user is an admin — for `reviewed_by` on verification rows. */
  adminRecordId: string | null;
  refreshProfile: () => Promise<void>;
  /** Re-read session from Supabase + reload profile — returns session after state is updated. */
  refreshSession: (options?: { quiet?: boolean }) => Promise<Session | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRecordId, setAdminRecordId] = useState<string | null>(null);
  /** Used to skip a second full-screen loading pass when `refreshSession` already loaded this user and `SIGNED_IN` fires again. */
  const lastLoadedUserIdRef = useRef<string | null>(null);

  const loadUserRow = useCallback(async (uid: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: u } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
      setDbUser(u as DbUser | null);
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
      setProfile(p as DbProfile | null);
      const { data: ad } = await supabase.from('admins').select('id').eq('user_id', uid).maybeSingle();
      setIsAdmin(!!ad);
      setAdminRecordId((ad?.id as string | undefined) ?? null);
      lastLoadedUserIdRef.current = uid;
    } catch (e) {
      if (__DEV__) {
        console.warn(
          '[Auth] profile fetch failed (offline or bad Supabase URL?).',
          e instanceof Error ? e.message : e
        );
      }
    }
  }, [isSupabaseConfigured]);

  const refreshSession = useCallback(async (options?: { quiet?: boolean }): Promise<Session | null> => {
    if (!isSupabaseConfigured) return null;
    const { session: s } = await getSessionRecoveringStale();
    setSession(s);
    if (s?.user?.id) {
      const showLoading = !options?.quiet;
      if (showLoading) setLoading(true);
      try {
        await loadUserRow(s.user.id);
      } finally {
        if (showLoading) setLoading(false);
      }
    } else {
      lastLoadedUserIdRef.current = null;
      setDbUser(null);
      setProfile(null);
      setIsAdmin(false);
      setAdminRecordId(null);
    }
    return s;
  }, [isSupabaseConfigured, loadUserRow]);

  const refreshProfile = async () => {
    if (session?.user?.id) await loadUserRow(session.user.id);
  };

  useEffect(() => {
    const linkSub = Linking.addEventListener('url', ({ url }) => captureAuthLinkIfPresent(url));
    void Linking.getInitialURL().then((url) => captureAuthLinkIfPresent(url));

    if (!isSupabaseConfigured) {
      if (__DEV__) {
        console.warn(
          '[Auth] Supabase env missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart Metro (npx expo start).'
        );
      }
      setLoading(false);
      return () => linkSub.remove();
    }
    void getSessionRecoveringStale()
      .then(({ session: s }) => {
        setSession(s);
        if (s?.user?.id) void loadUserRow(s.user.id).finally(() => setLoading(false));
        else setLoading(false);
      })
      .catch((e) => {
        if (__DEV__) {
          console.warn(
            '[Auth] getSession failed — check device internet, Supabase URL in .env, and Windows firewall for Metro (port 8081).',
            e instanceof Error ? e.message : e
          );
        }
        if (!peekPendingAuthUrl()) {
          void clearStaleAuthSession().finally(() => {
            setSession(null);
            setLoading(false);
          });
        } else {
          setSession(null);
          setLoading(false);
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user?.id) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (event === 'SIGNED_IN' && lastLoadedUserIdRef.current === s.user.id) {
            void loadUserRow(s.user.id);
            return;
          }
          setLoading(true);
          void loadUserRow(s.user.id).finally(() => setLoading(false));
        } else {
          void loadUserRow(s.user.id);
        }
      } else {
        lastLoadedUserIdRef.current = null;
        setDbUser(null);
        setProfile(null);
        setIsAdmin(false);
        setAdminRecordId(null);
      }
    });
    return () => {
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [loadUserRow]);

  /** Keep `dbUser` (verification_status, premium, etc.) in sync when the row changes in Supabase — not only on auth events. */
  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user?.id) return;
    const uid = session.user.id;
    const channel = supabase
      .channel(`realtime:users:${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
        () => {
          void loadUserRow(uid);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id, isSupabaseConfigured, loadUserRow]);

  /** Dashboard / admin edits while the app was backgrounded — refetch own user row when returning. */
  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user?.id) return;
    const uid = session.user.id;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void loadUserRow(uid);
    });
    return () => sub.remove();
  }, [session?.user?.id, isSupabaseConfigured, loadUserRow]);

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      lastLoadedUserIdRef.current = null;
      setSession(null);
      setDbUser(null);
      setProfile(null);
      setIsAdmin(false);
      setAdminRecordId(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error && __DEV__) console.warn('[Auth] signOut:', error.message);
    if (error) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      dbUser,
      profile,
      loading,
      isAdmin,
      adminRecordId,
      refreshProfile,
      refreshSession,
      signOut,
    }),
    [session, dbUser, profile, loading, isAdmin, adminRecordId, refreshSession, refreshProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth inside AuthProvider');
  return v;
}
