/**
 * PR3 — Premium success (post–Paystack checkout).
 */
import { Screen } from '@/components/Screen';
import { DiscoveryGradientBg } from '@/components/ui/DiscoveryGradientBg';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const UNLOCKED = [
  { icon: 'flash-outline' as const, title: 'Boost plans', body: 'Top placement in the feed' },
  { icon: 'options-outline' as const, title: 'Advanced filters', body: 'Price, distance, verified hosts' },
  { icon: 'airplane-outline' as const, title: 'Travel mode', body: 'Browse before you arrive' },
  { icon: 'heart-outline' as const, title: "Who's interested", body: 'Saves and interest on your plans' },
  { icon: 'arrow-undo-outline' as const, title: 'Undo hides', body: 'Bring back plans you dismissed' },
];

function formatRenewalLabel(until: string | null | undefined): string | null {
  if (!until) return null;
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PremiumSuccessScreen() {
  const { dbUser, refreshProfile } = useAuth();
  const active = isPremiumSubscriber(dbUser);
  const renews = formatRenewalLabel(dbUser?.premium_until ?? null);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );

  return (
    <Screen safeAreaEdges={['top', 'left', 'right', 'bottom']} safeAreaStyle={styles.screenRoot} scroll={false}>
      <View style={styles.flex}>
        <DiscoveryGradientBg />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBadge}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topBadgeGrad}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.topBadgeTxt}>{active ? 'Premium active' : 'Payment received'}</Text>
            </LinearGradient>
          </View>

          <View style={styles.heroOuter}>
            <LinearGradient
              colors={[colors.primary, '#8B7CE8', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroRing}
            >
              <View style={styles.heroCard}>
                <LinearGradient
                  colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.12)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroIconGrad}
                >
                  <View style={styles.heroIconCircle}>
                    <Ionicons name="diamond" size={40} color={colors.primary} />
                  </View>
                </LinearGradient>
                <Text style={styles.heroKicker}>Welcome to</Text>
                <Text style={styles.heroTitle}>LinkUp Premium</Text>
                <Text style={styles.heroSub}>
                  {renews
                    ? `Your membership is active through ${renews}.`
                    : 'Your perks unlock as soon as Paystack confirms — usually within seconds.'}
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>What you unlocked</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <View style={styles.benefitsCard}>
            {UNLOCKED.map((f, i) => (
              <View
                key={f.title}
                style={[styles.benefitRow, i === UNLOCKED.length - 1 && styles.benefitRowLast]}
              >
                <View style={styles.benefitIcon}>
                  <Ionicons name={f.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{f.title}</Text>
                  <Text style={styles.benefitBody}>{f.body}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            ))}
          </View>

          <View style={styles.syncCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={styles.syncTxt}>
              Verification is still required for paid meetups and escrow. Premium does not skip identity checks.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => router.replace('/(tabs)' as Href)}
            style={({ pressed }) => [styles.primaryCtaOuter, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Start boosting your plans"
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryCtaGrad}
            >
              <Ionicons name="flash-outline" size={20} color="#fff" />
              <Text style={styles.primaryCtaTxt}>Start boosting your plans</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(tabs)/profile' as Href)}
            style={({ pressed }) => [styles.secondaryCtaOuter, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.secondaryCtaRing}
            >
              <View style={styles.secondaryCtaInner}>
                <Text style={styles.secondaryCtaTxt}>Done</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  topBadge: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  topBadgeGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topBadgeTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  heroOuter: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  heroRing: { padding: 2, borderRadius: radius.xl },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl - 2,
    padding: spacing.lg,
    alignItems: 'center',
  },
  heroIconGrad: {
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  sectionHead: { marginBottom: spacing.sm },
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
  sectionRule: { height: 2, borderRadius: 1, opacity: 0.9 },
  benefitsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
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
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(108, 99, 255, 0.12)',
  },
  benefitRowLast: { borderBottomWidth: 0 },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, minWidth: 0 },
  benefitTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 2 },
  benefitBody: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  syncTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: 'rgba(245, 246, 250, 0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.12)',
  },
  primaryCtaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
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
    minHeight: 56,
  },
  primaryCtaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  secondaryCtaOuter: { borderRadius: radius.button, overflow: 'hidden' },
  secondaryCtaRing: { padding: 2, borderRadius: radius.button },
  secondaryCtaInner: {
    borderRadius: radius.button - 4,
    backgroundColor: colors.surface,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaTxt: { fontSize: 16, fontWeight: '800', color: colors.primary },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
});
