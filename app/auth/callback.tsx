/**
 * OAuth deep-link target — add this URL to Supabase Auth redirect allow list.
 * Mobile Google flow usually completes in-app via WebBrowser; this handles web / cold-start deep links.
 *
 * After handling the URL we call AuthContext.refreshSession() so React state matches AsyncStorage
 * (avoids routing to / with session still null → login flash).
 */
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  finalizeOAuthFromUrl,
  urlLooksLikeAuthRedirect,
  waitForSupabaseSession,
} from '@/lib/authProviders';
import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Phase = 'working' | 'ready' | 'failed';

export default function AuthCallbackScreen() {
  const { refreshSession } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('working');

  useEffect(() => {
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      /* native module may be unavailable */
    }

    let cancelled = false;
    let settled = false;
    const seen = new Set<string>();

    function setFinal(next: Phase) {
      if (settled || cancelled) return;
      settled = true;
      setPhase(next);
    }

    async function processAuthUrl(url: string | null) {
      try {
        const trimmed = url?.trim() ?? '';
        if (trimmed) {
          if (seen.has(trimmed)) return;
          seen.add(trimmed);
          const { error } = await finalizeOAuthFromUrl(trimmed);
          if (error && __DEV__) console.warn('[auth/callback]', error.message);
        }

        const expectAuth = trimmed ? urlLooksLikeAuthRedirect(trimmed) : false;
        await waitForSupabaseSession(expectAuth ? 48 : 12, 200);
        if (cancelled) return;

        await refreshSession();
        if (cancelled) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setFinal('ready');
          return;
        }

        if (expectAuth) {
          setFinal('failed');
          return;
        }

        setFinal('ready');
      } catch (e) {
        if (__DEV__) console.warn('[auth/callback] processAuthUrl', e);
        const trimmed = url?.trim() ?? '';
        const expectAuth = trimmed ? urlLooksLikeAuthRedirect(trimmed) : false;
        setFinal(expectAuth ? 'failed' : 'ready');
      }
    }

    /** Prefer a non-empty deep link; avoid finishing with null before the OS delivers the URL. */
    void (async () => {
      const initial = await Linking.getInitialURL();
      if (initial?.trim()) {
        await processAuthUrl(initial);
        return;
      }

      const fromEvent = await new Promise<string | null>((resolve) => {
        const t = setTimeout(() => resolve(null), 2800);
        const sub = Linking.addEventListener('url', ({ url }) => {
          clearTimeout(t);
          sub.remove();
          resolve(url);
        });
      });

      if (cancelled) return;
      await processAuthUrl(fromEvent ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  if (phase === 'working') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.t}>Completing sign-in…</Text>
      </View>
    );
  }

  if (phase === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>
          We could not finish signing you in. The link may have expired, or the app could not read the full URL
          (try opening the link again).
        </Text>
        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return <Redirect href="/" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: 16,
    padding: 24,
  },
  t: { color: colors.textMuted, marginTop: 8 },
  err: { color: colors.text, textAlign: 'center', lineHeight: 22, fontSize: 15 },
  btn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  btnPressed: { opacity: 0.85 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
