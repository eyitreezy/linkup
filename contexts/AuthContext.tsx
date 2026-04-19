/**
 * Auth + profile bootstrap — Supabase session and public.users row.
 */
import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbProfile, DbUser } from '@/types/database';

type AuthCtx = {
  session: Session | null;
  user: User | null;
  dbUser: DbUser | null;
  profile: DbProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  /** Re-read session from Supabase + reload profile — use after OAuth/email deep links to avoid stale React state. */
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const {
      data: { session: s },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      if (__DEV__) console.warn('[Auth] refreshSession:', error.message);
      return;
    }
    setSession(s);
    if (s?.user?.id) {
      setLoading(true);
      try {
        await loadUserRow(s.user.id);
      } finally {
        setLoading(false);
      }
    } else {
      lastLoadedUserIdRef.current = null;
      setDbUser(null);
      setProfile(null);
      setIsAdmin(false);
    }
  }, [isSupabaseConfigured, loadUserRow]);

  const refreshProfile = async () => {
    if (session?.user?.id) await loadUserRow(session.user.id);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (__DEV__) {
        console.warn(
          '[Auth] Supabase env missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart Metro (npx expo start).'
        );
      }
      setLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data: { session: s }, error }) => {
        if (error) {
          if (__DEV__) console.warn('[Auth] getSession:', error.message);
          setLoading(false);
          return;
        }
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
        setLoading(false);
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
      }
    });
    return () => subscription.unsubscribe();
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
      refreshProfile,
      refreshSession,
      signOut,
    }),
    [session, dbUser, profile, loading, isAdmin, refreshSession]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth inside AuthProvider');
  return v;
}
