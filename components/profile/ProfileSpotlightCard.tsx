/**
 * Profile spotlight — quota-aware CTA on Profile tab.
 */
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function ProfileSpotlightCard() {
  const { user, profile, refreshProfile } = useAuth();
  const { allowed, loading, metadata, effectiveTier } = usePermission('spotlight.profile', {
    checkQuota: true,
  });
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const used = (metadata?.quota_used as number | undefined) ?? 0;
  const limit = metadata?.quota_limit as number | undefined;
  const spotlightActive =
    profile?.spotlight_until && new Date(profile.spotlight_until).getTime() > Date.now();

  async function activate() {
    if (!user?.id || !allowed) {
      setUpgradeOpen(true);
      return;
    }
    setBusy(true);
    const until = new Date();
    until.setHours(until.getHours() + 24);
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ spotlight_until: until.toISOString() })
      .eq('user_id', user.id);
    if (!updErr && effectiveTier !== 'PLATINUM') {
      await supabase.rpc('record_boost_usage', { p_kind: 'spotlights' });
    }
    setBusy(false);
    if (updErr) return;
    await refreshProfile();
  }

  let quotaLabel = '';
  if (allowed && limit != null && limit > 0) {
    quotaLabel = `${used} of ${limit} spotlights used this month`;
  } else if (allowed && effectiveTier === 'PLATINUM') {
    quotaLabel = 'Unlimited spotlights';
  }

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
      <LinearGradient
        colors={['#FFF9E6', '#F3EEFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.row}>
          <Ionicons name="star" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Profile spotlight</Text>
            {quotaLabel ? <Text style={styles.sub}>{quotaLabel}</Text> : null}
            {spotlightActive ? (
              <Text style={styles.active}>Spotlight active until{' '}
                {new Date(profile!.spotlight_until!).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={() => void activate()}
          disabled={busy || loading}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTxt}>{allowed ? 'Spotlight my profile' : 'Upgrade for spotlight'}</Text>
          )}
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  card: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: 16, fontWeight: '900', color: colors.text },
  sub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  active: { fontSize: 12, fontWeight: '700', color: colors.success, marginTop: 4 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
