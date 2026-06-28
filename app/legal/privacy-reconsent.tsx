/**
 * Re-consent flow when a newer privacy policy version is published.
 */
import { Button } from '@/components/Button';
import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { recordPrivacyConsent } from '@/lib/privacy/recordPrivacyConsent';
import { supabase } from '@/lib/supabase';
import type { DbPrivacyPolicyVersion } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function PrivacyReconsentScreen() {
  const { user } = useAuth();
  const [version, setVersion] = useState<DbPrivacyPolicyVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('privacy_policy_versions')
        .select('*')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      setVersion((data as DbPrivacyPolicyVersion | null) ?? null);
      setLoading(false);
    })();
  }, []);

  async function handleAccept() {
    if (!version || !user?.id || busy) return;
    setBusy(true);
    await recordPrivacyConsent(user.id, 're_consent');
    setBusy(false);
    router.back();
  }

  return (
    <SettingsStickyShell contentContainerStyle={styles.scroll}>
      <View style={styles.heroHeader}>
        <LinearGradient
          colors={[colors.primary, '#8B7CFF', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBadge}
        >
          <Ionicons name="document-text-outline" size={24} color="#fff" />
        </LinearGradient>
        <View style={styles.heroText}>
          <Text style={styles.heroKicker}>Legal</Text>
          <Text style={styles.heroTitle}>Updated Privacy Policy</Text>
          <Text style={styles.heroSub}>
            Please review what changed and accept to keep using LinkUp.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.content}>
          {version?.summary_of_changes ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>What&apos;s changed</Text>
              <Text style={styles.summaryText}>{version.summary_of_changes}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push('/legal/privacy-policy' as Href)}
            style={({ pressed }) => [styles.fullPolicyLink, pressed && { opacity: 0.88 }]}
            accessibilityRole="link"
          >
            <Text style={styles.fullPolicyLinkText}>Read the full policy →</Text>
          </Pressable>

          <Button
            title="I agree"
            onPress={() => void handleAccept()}
            loading={busy}
            disabled={!version}
            gradient
            fullWidth
          />
        </View>
      )}
    </SettingsStickyShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120 },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 21,
  },
  loader: { marginTop: spacing.xl },
  content: { gap: spacing.md },
  summaryCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.15)',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  fullPolicyLink: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  fullPolicyLinkText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
