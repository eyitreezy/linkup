/**
 * Email confirmation + OAuth (`linkup://auth/callback?...`).
 * Reads full URL from Linking — query/hash tokens are not in the route path alone.
 */
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { completePostAuthFromDeepLink } from '@/lib/auth/completePostAuth';
import { isRecoveryAuthUrl } from '@/lib/auth/passwordReset';
import { captureAuthLinkIfPresent } from '@/lib/auth/pendingAuthUrl';
import { urlLooksLikeAuthRedirect } from '@/lib/authProviders';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Phase = 'working' | 'failed';

export default function AuthCallbackScreen() {
  const { refreshSession } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('working');
  const ranRef = useRef(false);
  const [recoveryFlow, setRecoveryFlow] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      /* ignore */
    }

    let cancelled = false;

    async function run() {
      const initial = (await Linking.getInitialURL())?.trim() ?? '';
      captureAuthLinkIfPresent(initial);
      if (isRecoveryAuthUrl(initial)) setRecoveryFlow(true);

      let url = initial;

      if (!url || !urlLooksLikeAuthRedirect(url)) {
        url = await new Promise<string>((resolve) => {
          const t = setTimeout(() => resolve(initial), 6000);
          const sub = Linking.addEventListener('url', ({ url: u }) => {
            if (u?.trim()) {
              captureAuthLinkIfPresent(u);
              if (isRecoveryAuthUrl(u)) setRecoveryFlow(true);
              clearTimeout(t);
              sub.remove();
              resolve(u.trim());
            }
          });
        });
      }

      if (cancelled) return;

      const result = await completePostAuthFromDeepLink({
        url: url || initial || null,
        refreshSession,
        router,
      });

      if (cancelled) return;

      if (result === 'failed') {
        setPhase('failed');
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [refreshSession, router]);

  if (phase === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>
          {recoveryFlow
            ? 'We could not open your reset link. Request a new email from Forgot password, tap the purple Reset button (not plain text), and open the link on this phone with LinkUp installed.'
            : 'We could not finish signing you in. Open the confirmation link on the same phone where you signed up, or request a new email and try again. You can also sign in with your password if your email is already confirmed.'}
        </Text>
        <Pressable
          onPress={() =>
            router.replace((recoveryFlow ? '/(auth)/forgot-password' : '/(auth)/login') as Href)
          }
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>{recoveryFlow ? 'Request new reset link' : 'Back to sign in'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.hint}>{recoveryFlow ? 'Opening password reset…' : 'Confirming your email…'}</Text>
    </View>
  );
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
  hint: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
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
