/**
 * PR1 — Premium overview: value prop, features, tier selection.
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { PREMIUM_TIERS } from '@/lib/premium/catalog';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { useAuth } from '@/contexts/AuthContext';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FEATURES = [
  { icon: 'flash-outline' as const, title: 'Boost your plans', body: 'Jump to the top of the feed for more offers.' },
  { icon: 'eye-outline' as const, title: "See who's interested", body: 'View saves and profile views on your plans.' },
  { icon: 'options-outline' as const, title: 'Advanced filters', body: 'Filter by price, distance, and verified hosts.' },
  { icon: 'airplane-outline' as const, title: 'Travel mode', body: 'Browse another city before you arrive.' },
  { icon: 'arrow-undo-outline' as const, title: 'Undo actions', body: 'Bring back the last plan you hid from the feed.' },
];

export default function PremiumOverviewScreen() {
  const { dbUser } = useAuth();
  const [selected, setSelected] = useState(PREMIUM_TIERS.find((t) => t.recommended)?.id ?? 'monthly');
  const subscriber = isPremiumSubscriber(dbUser);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Stand out and get more offers</Text>
          <Text style={styles.heroSub}>
            Premium helps people discover your plans. Verification is still required for hosting paid meetups and escrow —
            paying never skips identity checks.
          </Text>
        </View>

        <Text style={styles.section}>What you unlock</Text>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureBody}>{f.body}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.section}>Choose a plan</Text>
        {PREMIUM_TIERS.map((t) => {
          const on = selected === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setSelected(t.id)}
              style={[styles.tier, on && styles.tierOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <View style={styles.tierTop}>
                <Text style={styles.tierTitle}>{t.title}</Text>
                {t.recommended ? <Text style={styles.rec}>Recommended</Text> : null}
              </View>
              <Text style={styles.tierSub}>{t.subtitle}</Text>
              <Text style={styles.tierPrice}>
                NGN {(t.priceKobo / 100).toLocaleString()} · +{t.bonusBoostCredits} boosts
              </Text>
            </Pressable>
          );
        })}

        <Button
          title={subscriber ? 'Extend or change plan' : 'Continue'}
          onPress={() => router.push(`/premium/checkout?tier=${selected}` as Href)}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  hero: { marginBottom: spacing.xl },
  heroTitle: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, lineHeight: 34 },
  heroSub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginTop: spacing.md },
  section: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing.md },
  featureCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  featureBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  tier: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  tierOn: { borderColor: colors.primary, backgroundColor: '#F8F7FF' },
  tierTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  rec: { fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' },
  tierSub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  tierPrice: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
});
