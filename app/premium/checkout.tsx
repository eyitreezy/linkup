/**
 * PR2 — Checkout: Paystack + demo fulfillment for premium_until / subscription_status.
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { applyPremiumPurchase } from '@/lib/premium/applyPurchase';
import { getTier } from '@/lib/premium/catalog';
import { openPremiumPaystackCheckout } from '@/lib/premium/openPremiumCheckout';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PremiumCheckoutScreen() {
  const { tier: tierParam } = useLocalSearchParams<{ tier: string }>();
  const { user, refreshProfile } = useAuth();
  const tier = getTier(tierParam) ?? getTier('monthly')!;
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!user?.id || !user.email) {
      Alert.alert('Checkout', 'Sign in with an email to continue.');
      return;
    }
    setBusy(true);
    const res = await openPremiumPaystackCheckout({
      email: user.email,
      userId: user.id,
      tier,
    });
    setBusy(false);
    if (!res.ok) Alert.alert('Paystack', res.error ?? 'Could not open checkout.');
  }

  async function demoComplete() {
    if (!user?.id || !isSupabaseConfigured) return;
    setBusy(true);
    const { error } = await applyPremiumPurchase(supabase, user.id, tier);
    setBusy(false);
    if (error) Alert.alert('Error', error);
    else {
      await refreshProfile();
      router.replace('/premium/success' as Href);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Complete upgrade</Text>
        <Text style={styles.sub}>Demo: open Paystack in the browser, then confirm below to unlock Premium in the app.</Text>

        <View style={styles.card}>
          <Text style={styles.planLabel}>Plan</Text>
          <Text style={styles.planVal}>{tier.title} · {tier.subtitle}</Text>
          <Text style={styles.planLabel}>Price</Text>
          <Text style={styles.planVal}>
            NGN {(tier.priceKobo / 100).toLocaleString()} {tier.currency}
          </Text>
          <Text style={styles.planLabel}>Duration</Text>
          <Text style={styles.planVal}>{tier.durationDays} days</Text>
          <Text style={styles.planLabel}>Bonus boosts</Text>
          <Text style={styles.planVal}>+{tier.bonusBoostCredits} credits</Text>
        </View>

        <Button title="Pay with Paystack" onPress={() => void pay()} loading={busy} />
        <Button
          title="I completed payment (demo unlock)"
          variant="secondary"
          onPress={() => void demoComplete()}
          loading={busy}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  sub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm },
  planVal: { fontSize: 17, fontWeight: '800', color: colors.text },
});
