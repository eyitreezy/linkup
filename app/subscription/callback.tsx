/**
 * Deep link return after Flutterwave checkout — refresh entitlements.
 */
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { invalidatePermissionCache } from '@/lib/subscription/checkPermission';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function SubscriptionCallbackScreen() {
  const { refreshProfile } = useAuth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      invalidatePermissionCache();
      await refreshProfile();
      setDone(true);
      setTimeout(() => router.replace('/subscription' as Href), 800);
    })();
  }, [refreshProfile]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.txt}>{done ? 'Subscription updated' : 'Confirming payment…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
  txt: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
});
