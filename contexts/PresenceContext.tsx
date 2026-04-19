/**
 * Own presence heartbeat + typing broadcast (Supabase user_presence).
 */
import { useAuth } from '@/contexts/AuthContext';
import {
  setOfflinePresence,
  updateTypingTarget,
  upsertOnlineHeartbeat,
} from '@/lib/presence/presenceHeartbeat';
import { getVisibilityPrefs } from '@/lib/presence/visibilityPrefs';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const HEARTBEAT_MS = 45_000;
const TYPING_DEBOUNCE_MS = 320;
const TYPING_IDLE_CLEAR_MS = 2_600;

type Ctx = {
  /** Call when user types in a chat (debounced + idle-clear inside). */
  signalTyping: (conversationId: string) => void;
  clearTyping: () => void;
};

const PresenceCtx = createContext<Ctx | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const uid = user?.id ?? null;
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBeatRef = useRef(0);

  const runHeartbeat = useCallback(async () => {
    if (!uid || !isSupabaseConfigured) return;
    const now = Date.now();
    if (now - lastBeatRef.current < 25_000) return;
    lastBeatRef.current = now;
    try {
      await upsertOnlineHeartbeat(uid);
    } catch {
      /* offline / RLS */
    }
  }, [uid]);

  useEffect(() => {
    if (!uid || !isSupabaseConfigured) return;
    lastBeatRef.current = 0;
    void upsertOnlineHeartbeat(uid);
    const t = setInterval(() => {
      if (AppState.currentState === 'active') void runHeartbeat();
    }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [uid, runHeartbeat]);

  useEffect(() => {
    if (!uid || !isSupabaseConfigured) return;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        lastBeatRef.current = 0;
        void upsertOnlineHeartbeat(uid);
      } else if (s === 'background' || s === 'inactive') {
        void setOfflinePresence(uid);
        void updateTypingTarget(uid, null);
      }
    });
    return () => sub.remove();
  }, [uid]);

  const clearTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    typingTimerRef.current = null;
    typingIdleRef.current = null;
    if (!uid || !isSupabaseConfigured) return;
    const v = getVisibilityPrefs(profile);
    if (!v.share_typing_indicator) return;
    void updateTypingTarget(uid, null);
  }, [uid, profile]);

  const signalTyping = useCallback(
    (conversationId: string) => {
      if (!uid || !isSupabaseConfigured) return;
      const v = getVisibilityPrefs(profile);
      if (!v.share_typing_indicator) return;

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        void updateTypingTarget(uid, conversationId);
      }, TYPING_DEBOUNCE_MS);

      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      typingIdleRef.current = setTimeout(() => {
        void updateTypingTarget(uid, null);
      }, TYPING_IDLE_CLEAR_MS);
    },
    [uid, profile]
  );

  useEffect(() => {
    const u = uid;
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      if (u && isSupabaseConfigured) {
        void setOfflinePresence(u);
        void updateTypingTarget(u, null);
      }
    };
  }, [uid]);

  const value = useMemo(() => ({ signalTyping, clearTyping }), [signalTyping, clearTyping]);

  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>;
}

export function usePresenceActions() {
  const v = useContext(PresenceCtx);
  if (!v) throw new Error('usePresenceActions inside PresenceProvider');
  return v;
}

/** Optional: chat can call without throwing when provider missing. */
export function usePresenceActionsSafe(): Ctx | null {
  return useContext(PresenceCtx) ?? null;
}
