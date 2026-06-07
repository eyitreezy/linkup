/**
 * PR2 — Checkout: Paystack + demo fulfillment (inbox-grade shell).
 */
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { applyPremiumPurchase } from '@/lib/premium/applyPurchase';
import { getTier } from '@/lib/premium/catalog';
import { openPremiumPaystackCheckout } from '@/lib/premium/openPremiumCheckout';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

export default function PremiumCheckoutScreen() {
  const { tier: tierParam } = useLocalSearchParams<{ tier: string }>();
  const { user, refreshProfile } = useAuth();
  const tier = getTier(tierParam) ?? getTier('monthly')!;
  const [busy, setBusy] = useState(false);

  const priceDisplay = `${tier.currency} ${(tier.priceKobo / 100).toLocaleString()}`;

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
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.topNav}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.topNavBadge}>
            <Ionicons name="card-outline" size={16} color={colors.primary} />
            <Text style={styles.topNavBadgeText}>Checkout</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Premium</Text>
              <Text style={styles.leadTitle}>Complete upgrade</Text>
              <Text style={styles.leadSub}>
                Paystack opens in a secure browser tab. After payment you return to LinkUp automatically.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Order summary</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <View style={styles.summaryCard}>
            <SummaryRow label="Plan" value={`${tier.title} · ${tier.subtitle}`} />
            <View style={styles.summaryDivider} />
            <SummaryRow label="Price" value={priceDisplay} />
            <View style={styles.summaryDivider} />
            <SummaryRow label="Duration" value={`${tier.durationDays} days`} />
            <View style={styles.summaryDivider} />
            <SummaryRow label="Bonus boosts" value={`+${tier.bonusBoostCredits} credits`} />
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Payment</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <Pressable
            onPress={() => void pay()}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryCtaOuter,
              busy && { opacity: 0.65 },
              pressed && !busy && { opacity: 0.94, transform: [{ scale: 0.985 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pay with Paystack"
          >
            <LinearGradient
              colors={busy ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryCtaGrad}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryCtaTxt}>Pay with Paystack</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => void demoComplete()}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondaryCtaOuter,
              busy && { opacity: 0.55 },
              pressed && !busy && { opacity: 0.92 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="I completed payment, demo unlock"
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.secondaryCtaRing}
            >
              <View style={styles.secondaryCtaInner}>
                {busy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.secondary} />
                    <Text style={styles.secondaryCtaTxt} numberOfLines={2}>
                      I completed payment (demo unlock)
                    </Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </Pressable>

          <Text style={styles.footnote}>
            Payments are processed securely. Verification is still required for paid meetups and escrow.
          </Text>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  topNavBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  topNavBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 56,
  },
  leadTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 34,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  sectionHead: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  summaryRow: {
    paddingVertical: spacing.sm,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 24,
  },
  primaryCtaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
    }),
  },
  primaryCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  primaryCtaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryCtaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  secondaryCtaRing: {
    padding: 2,
    borderRadius: radius.button,
  },
  secondaryCtaInner: {
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryCtaTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.secondary,
    flexShrink: 1,
    textAlign: 'center',
  },
  footnote: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
