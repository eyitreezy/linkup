/**
 * PR1 — Premium overview: inbox-grade shell, feature rows, tier selection.
 */
import { Screen } from '@/components/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { PREMIUM_TIERS } from '@/lib/premium/catalog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const FEATURES = [
  { icon: 'flash-outline' as const, title: 'Boost your plans', body: 'Jump to the top of the feed for more offers.' },
  { icon: 'eye-outline' as const, title: 'Who viewed your profile', body: 'See recent visitors (privacy-safe counters in-app).' },
  { icon: 'heart-outline' as const, title: "Who's into your plans", body: 'Interest and saves surfaced for your meetups.' },
  { icon: 'options-outline' as const, title: 'Advanced filters', body: 'Filter by price, distance, and verified hosts.' },
  { icon: 'airplane-outline' as const, title: 'Travel mode', body: 'Browse another city before you arrive.' },
  { icon: 'arrow-undo-outline' as const, title: 'Undo actions', body: 'Bring back the last plan you hid from the feed.' },
  { icon: 'star-outline' as const, title: 'Spotlight & visibility', body: 'Longer feed presence and boosted placement.' },
  { icon: 'shield-outline' as const, title: 'Priority dispute handling', body: 'Premium reporters get a faster review queue flag.' },
];

export default function PremiumOverviewScreen() {
  const { dbUser } = useAuth();
  const [selected, setSelected] = useState(PREMIUM_TIERS.find((t) => t.recommended)?.id ?? 'monthly');
  const subscriber = isPremiumSubscriber(dbUser);

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
          {!subscriber ? (
            <View style={styles.topNavBadge}>
              <Ionicons name="diamond-outline" size={16} color={colors.primary} />
              <Text style={styles.topNavBadgeText}>Premium</Text>
            </View>
          ) : (
            <View style={styles.topNavSpacer} />
          )}
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
              <Text style={styles.leadKicker}>Membership</Text>
              <Text style={styles.leadTitle}>Stand out and get more offers</Text>
              <Text style={styles.leadSub}>
                Premium helps people discover your plans. Verification is still required for hosting paid meetups and
                escrow — paying never skips identity checks.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>What you unlock</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <View style={styles.listBlock}>
            {FEATURES.map((f, index) => (
              <View
                key={f.title}
                style={[
                  styles.featureRow,
                  index === FEATURES.length - 1 ? styles.featureRowLast : null,
                ]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={f.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureBody}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Choose a plan</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <View style={styles.tierList}>
            {PREMIUM_TIERS.map((t) => {
              const on = selected === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSelected(t.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [pressed && styles.pressedTier]}
                >
                  {on ? (
                    <LinearGradient
                      colors={[colors.primary, '#8B7CE8', colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tierRing}
                    >
                      <View style={styles.tierInnerOn}>
                        <View style={styles.tierTop}>
                          <Text style={styles.tierTitle}>{t.title}</Text>
                          {t.recommended ? (
                            <LinearGradient
                              colors={[colors.primary, colors.secondary]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.recPill}
                            >
                              <Text style={styles.recPillTxt}>Recommended</Text>
                            </LinearGradient>
                          ) : null}
                        </View>
                        <Text style={styles.tierSub}>{t.subtitle}</Text>
                        <Text style={styles.tierPrice}>
                          NGN {(t.priceKobo / 100).toLocaleString()} · +{t.bonusBoostCredits} boosts
                        </Text>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tierCardIdle}>
                      <View style={styles.tierTop}>
                        <Text style={styles.tierTitle}>{t.title}</Text>
                        {t.recommended ? <Text style={styles.recIdle}>Recommended</Text> : null}
                      </View>
                      <Text style={styles.tierSub}>{t.subtitle}</Text>
                      <Text style={styles.tierPrice}>
                        NGN {(t.priceKobo / 100).toLocaleString()} · +{t.bonusBoostCredits} boosts
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push(`/premium/checkout?tier=${selected}` as Href)}
            style={({ pressed }) => [styles.ctaOuter, pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] }]}
            accessibilityRole="button"
            accessibilityLabel={subscriber ? 'Extend or change plan' : 'Continue to checkout'}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaTxt}>{subscriber ? 'Extend or change plan' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
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
  topNavSpacer: { width: 44, height: 44 },
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
  sectionHeadSpaced: {
    marginTop: spacing.lg,
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
  listBlock: { marginBottom: spacing.sm },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  featureRowLast: { marginBottom: 0 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: 'rgba(108, 99, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  featureTextCol: { flex: 1, minWidth: 0 },
  featureTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  featureBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '600',
  },
  tierList: { gap: spacing.sm, marginBottom: spacing.lg },
  pressedTier: { opacity: 0.96 },
  tierRing: {
    borderRadius: radius.lg,
    padding: 2,
  },
  tierInnerOn: {
    borderRadius: radius.lg - 1,
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: spacing.lg,
  },
  tierCardIdle: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  tierTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  tierTitle: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1, minWidth: 0 },
  recIdle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  recPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
  },
  recPillTxt: { fontSize: 10, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.6 },
  tierSub: { fontSize: 14, color: colors.textMuted, marginTop: 4, fontWeight: '600', lineHeight: 20 },
  tierPrice: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  ctaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.sm,
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
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  ctaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
