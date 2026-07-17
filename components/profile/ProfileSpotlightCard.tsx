/**
 * Profile spotlight — quota-aware CTA on Profile tab (linkup-web parity).
 */
import { TierBadge } from '@/components/TierBadge';
import { QuotaPipRow } from '@/components/subscription/QuotaPipRow';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { MONTHLY_SPOTLIGHTS } from '@/lib/subscription/boostQuota';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function formatSpotlightExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ProfileSpotlightCard() {
  const { user, profile, refreshProfile } = useAuth();
  const { allowed, loading, metadata, effectiveTier } = usePermission('spotlight.profile', {
    checkQuota: true,
  });
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const used = (metadata?.quota_used as number | undefined) ?? 0;
  const limit = metadata?.quota_limit as number | undefined;
  const isUnlimited = effectiveTier === 'PLATINUM' || limit === -1;
  const total =
    limit != null && limit > 0 ? limit : Math.max(0, MONTHLY_SPOTLIGHTS[effectiveTier]);
  const remaining = isUnlimited ? Infinity : Math.max(0, total - used);
  const spotlightActive =
    profile?.spotlight_until && new Date(profile.spotlight_until).getTime() > Date.now();

  async function activate() {
    if (!user?.id || !allowed) {
      setUpgradeOpen(true);
      return;
    }
    if (spotlightActive || (!isUnlimited && remaining === 0)) return;

    setBusy(true);
    const until = new Date();
    until.setHours(until.getHours() + 24);
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ spotlight_until: until.toISOString() })
      .eq('user_id', user.id);
    if (!updErr && !isUnlimited) {
      await supabase.rpc('record_boost_usage', { p_kind: 'spotlights' });
    }
    setBusy(false);
    if (updErr) return;
    await refreshProfile();
  }

  const ctaDisabled =
    busy || loading || !!spotlightActive || (allowed && !isUnlimited && remaining === 0);

  return (
    <View style={styles.wrap}>
      <UpgradePrompt
        visible={upgradeOpen}
        feature="spotlight.profile"
        requiredTier="SILVER"
        onUpgrade={() => {
          setUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.lead}>
            <LinearGradient
              colors={['#FBBF24', '#FB923C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconShell}
            >
              <Ionicons name="star" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.copy}>
              <Text style={styles.kicker}>Visibility</Text>
              <Text style={styles.title}>Profile spotlight</Text>
              <Text style={styles.sub} numberOfLines={2}>
                {spotlightActive
                  ? `Active until ${formatSpotlightExpiry(profile!.spotlight_until!)}`
                  : 'Promote your profile for 24 hours in Discover'}
              </Text>
            </View>
          </View>
          {spotlightActive ? (
            <View style={styles.livePill}>
              <Ionicons name="sparkles" size={10} color="#B45309" />
              <Text style={styles.liveTxt}>Active</Text>
            </View>
          ) : null}
        </View>

        {allowed && !isUnlimited && total > 0 ? (
          <View style={styles.quotaIndent}>
            <QuotaPipRow variant="embedded" total={total} used={used} />
          </View>
        ) : null}

        {allowed && isUnlimited ? (
          <Text style={styles.unlimitedTxt}>Unlimited spotlights</Text>
        ) : null}

        {allowed ? (
          <Pressable
            onPress={() => void activate()}
            disabled={ctaDisabled}
            style={({ pressed }) => [
              styles.ctaOuter,
              ctaDisabled && styles.ctaDisabled,
              pressed && !ctaDisabled && { opacity: 0.94 },
            ]}
          >
            <LinearGradient
              colors={
                ctaDisabled
                  ? ['rgba(229,231,235,0.95)', 'rgba(229,231,235,0.95)']
                  : [colors.primary, '#8B7CFF', colors.secondary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.ctaTxt, ctaDisabled && styles.ctaTxtDisabled]}>
                  {spotlightActive
                    ? 'Spotlight active'
                    : remaining === 0
                      ? 'Monthly limit reached'
                      : 'Spotlight my profile'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setUpgradeOpen(true)}
            style={({ pressed }) => [styles.lockedBtn, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.lockedTxt}>Available on Silver and above</Text>
            <TierBadge tier="SILVER" compact />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.md, marginBottom: spacing.lg },
  card: {
    alignSelf: 'stretch',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    backgroundColor: colors.cardSurface,
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  lead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  quotaIndent: { paddingLeft: 44 + spacing.sm },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  sub: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  liveTxt: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#B45309',
  },
  unlimitedTxt: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  ctaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  ctaDisabled: { opacity: 0.72 },
  ctaGrad: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.button,
  },
  ctaTxt: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  ctaTxtDisabled: { color: colors.textMuted },
  lockedBtn: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  lockedTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
});
