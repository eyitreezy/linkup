/**
 * Entry redirect — auth deep links → callback; session + pending onboarding → wizard; else login/tabs.
 */
import { colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { captureAuthLinkIfPresent } from '@/lib/auth/pendingAuthUrl';
import { postAuthHref } from '@/lib/auth/postAuthNavigation';
import { urlLooksLikeAuthRedirect } from '@/lib/authProviders';
import * as Linking from 'expo-linking';
import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const [pendingAuthLink, setPendingAuthLink] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      const u = url?.trim() ?? '';
      if (u) captureAuthLinkIfPresent(u);
      setPendingAuthLink(
        Boolean(u && (u.toLowerCase().includes('auth/callback') || urlLooksLikeAuthRedirect(u)))
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (pendingAuthLink === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (pendingAuthLink) {
    return <Redirect href={'/auth/callback' as Href} />;
  }

  if (session?.user) {
    return <Redirect href={postAuthHref(profile)} />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={'/(auth)/login' as Href} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
