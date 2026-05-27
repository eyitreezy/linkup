import { useAuth } from '@/contexts/AuthContext';
import { getSessionRecoveringStale } from '@/lib/auth/sessionRecovery';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const MAX_ATTEMPTS = 16;
const DELAY_MS = 200;

/**
 * Ensures Supabase session is visible before onboarding/login gates run.
 * Polls storage when AuthContext state lags behind email-confirm deep link.
 */
export function useAuthBootstrap() {
  const { session, user, loading: authLoading, refreshSession } = useAuth();
  const [storageSession, setStorageSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (session?.user) {
        setStorageSession(session);
        if (!cancelled) setSyncing(false);
        return;
      }

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const { session: s } = await getSessionRecoveringStale();
        if (cancelled) return;
        if (s?.user) {
          setStorageSession(s);
          await refreshSession({ quiet: true });
          break;
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      if (!cancelled) setSyncing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, refreshSession]);

  const activeSession = session ?? storageSession;
  const ready = !syncing && (!authLoading || !!activeSession?.user);

  return {
    session: activeSession,
    user: user ?? activeSession?.user ?? null,
    ready,
    authLoading: syncing || (authLoading && !activeSession?.user),
  };
}
