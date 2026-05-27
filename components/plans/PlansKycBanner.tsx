/**
 * Dismissible soft verification banner on Plans (non-blocking).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const STORAGE_KEY = 'linkup_plans_kyc_banner_dismissed';

type Props = {
  visible: boolean;
};

export function PlansKycBanner({ visible }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const v = await AsyncStorage.getItem(STORAGE_KEY);
      if (alive) setDismissed(v === '1');
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }, []);

  const verify = useCallback(() => {
    router.push('/kyc' as Href);
  }, []);

  if (!visible || dismissed) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <View style={styles.iconRow}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          <Text style={styles.title}>Help others feel safe meeting you</Text>
        </View>
        <Text style={styles.body}>
          Verification unlocks suggesting hangouts, chatting details, and optional secure holds — so real meetups feel
          human, not risky.
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={verify} style={styles.primary} accessibilityRole="button" accessibilityLabel="Verify now">
            <Text style={styles.primaryTxt}>Verify now</Text>
          </Pressable>
          <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  inner: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  primary: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dismiss: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
});
