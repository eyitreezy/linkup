/**
 * Public privacy policy viewer — works pre-auth (RLS allows public read).
 */
import { PrivacyPolicyBody } from '@/components/legal/PrivacyPolicyBody';
import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { DbPrivacyPolicyVersion } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function PrivacyPolicyScreen() {
  const [version, setVersion] = useState<DbPrivacyPolicyVersion | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <SettingsStickyShell contentContainerStyle={styles.scroll}>
      <View style={styles.heroHeader}>
        <LinearGradient
          colors={[colors.primary, '#8B7CFF', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBadge}
        >
          <Ionicons name="shield-checkmark-outline" size={24} color="#fff" />
        </LinearGradient>
        <View style={styles.heroText}>
          <Text style={styles.heroKicker}>Legal</Text>
          <Text style={styles.heroTitle}>Privacy Policy</Text>
          <Text style={styles.heroSub}>How LinkUp collects, uses, and protects your data.</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : version ? (
        <>
          <Text style={styles.versionLabel}>
            Version {version.version} · Effective {formatDate(version.effective_date)}
          </Text>
          <PrivacyPolicyBody content={version.content} />
        </>
      ) : (
        <Text style={styles.emptyText}>No privacy policy is currently available.</Text>
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
  versionLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
