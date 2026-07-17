/**
 * Deep link return after Flutterwave checkout — refresh entitlements.
 */
import { colors, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { invalidatePermissionCache } from '@/lib/subscription/checkPermission';
import { Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function SubscriptionCallbackScreen() {
  const { refreshProfile } = useAuth();
  const [done, setDone] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    let active = true;
    void (async () => {
      try {
        invalidatePermissionCache();
        await refreshProfile();
        if (!active) return;
        setDone(true);
        setTimeout(() => {
          if (active) router.replace('/subscription' as Href);
        }, 800);
      } catch (e) {
        console.error('[SubscriptionCallback] refresh failed:', e);
        if (active) router.replace('/subscription' as Href);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.txt}>{done ? 'Subscription updated' : 'Confirming payment…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.splashBackground },
  txt: { fontSize: 16, fontWeight: '700',
    fontFamily: fonts.medium, color: colors.textMuted },
});
