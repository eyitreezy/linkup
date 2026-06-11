import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { checkPermission, invalidatePermissionCache } from '@/lib/subscription/checkPermission';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

type BlockRow = { blocked_id: string; created_at: string };

function PrefSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: 'rgba(26, 29, 38, 0.14)', true: colors.primary }}
      thumbColor={Platform.OS === 'android' ? (value ? '#5EEAD4' : '#F3F4F6') : undefined}
      ios_backgroundColor="rgba(26, 29, 38, 0.14)"
    />
  );
}

export default function PrivacySafetyScreen() {
  const { user, profile, dbUser, refreshProfile } = useAuth();
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [isPlatinum, setIsPlatinum] = useState(false);
  const [incognitoEnabled, setIncognitoEnabled] = useState(false);
  const [profileViewPrivacyEnabled, setProfileViewPrivacyEnabled] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    const { data } = await supabase.from('user_blocks').select('blocked_id, created_at').eq('blocker_id', user.id);
    setBlocks((data as BlockRow[]) ?? []);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setIncognitoEnabled(!!profile?.incognito_browse_enabled);
    setProfileViewPrivacyEnabled(!!profile?.profile_view_privacy_enabled);
  }, [profile?.incognito_browse_enabled, profile?.profile_view_privacy_enabled]);

  useEffect(() => {
    if (!user?.id) {
      setIsPlatinum(false);
      return;
    }
    void checkPermission(user.id, 'privacy.incognito_browse').then((r) => {
      setIsPlatinum(r.effectiveTier === 'PLATINUM');
    });
  }, [user?.id, dbUser?.subscription_tier]);

  const savePrivacyToggle = useCallback(
    async (next: { incognito?: boolean; profileViewPrivacy?: boolean }) => {
      if (!user || !isSupabaseConfigured || privacyBusy) return;
      setPrivacyBusy(true);
      const incognito =
        next.incognito !== undefined ? next.incognito : incognitoEnabled;
      const profileViewPrivacy =
        next.profileViewPrivacy !== undefined ? next.profileViewPrivacy : profileViewPrivacyEnabled;
      const { error } = await supabase
        .from('profiles')
        .update({
          incognito_browse_enabled: incognito,
          profile_view_privacy_enabled: profileViewPrivacy,
        })
        .eq('user_id', user.id);
      setPrivacyBusy(false);
      if (error) return;
      invalidatePermissionCache();
      await refreshProfile();
    },
    [
      user,
      privacyBusy,
      incognitoEnabled,
      profileViewPrivacyEnabled,
      refreshProfile,
    ]
  );

  return (
    <SettingsStickyShell contentContainerStyle={styles.scroll}>
          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Trust</Text>
              <Text style={styles.leadTitle}>Privacy & safety</Text>
              <Text style={styles.leadSub}>
                Blocked people won&apos;t appear in your plans feed. Reports and serious issues: reach Help &amp;
                Support.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/support' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open help and support"
            style={({ pressed }) => [styles.helpCtaOuter, pressed && styles.helpCtaPressed]}
          >
            <LinearGradient
              colors={[colors.primary, '#8B7CE8', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.helpCtaGrad}
            >
              <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.helpCtaTxt}>Help & support</Text>
            </LinearGradient>
          </Pressable>

          {isPlatinum ? (
            <>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadRow}>
                  <View style={styles.sectionAccentDot} />
                  <Text style={styles.blockedSectionHeading}>Platinum privacy</Text>
                </View>
                <LinearGradient
                  colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sectionRule}
                />
              </View>
              <LinearGradient
                colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardOuter}
              >
                <View style={styles.cardInner}>
                  <View style={styles.prefRow}>
                    <View style={styles.prefTextCol}>
                      <Text style={styles.prefLabel}>Incognito browsing</Text>
                      <Text style={styles.prefSub}>
                        Browse plans and profiles without appearing in view logs.
                      </Text>
                    </View>
                    <PrefSwitch
                      value={incognitoEnabled}
                      onValueChange={(v) => {
                        setIncognitoEnabled(v);
                        void savePrivacyToggle({ incognito: v });
                      }}
                    />
                  </View>
                  <View style={[styles.prefRow, styles.prefRowBorder]}>
                    <View style={styles.prefTextCol}>
                      <Text style={styles.prefLabel}>Profile view privacy</Text>
                      <Text style={styles.prefSub}>
                        Control whether others see that you viewed their profile.
                      </Text>
                    </View>
                    <PrefSwitch
                      value={profileViewPrivacyEnabled}
                      onValueChange={(v) => {
                        setProfileViewPrivacyEnabled(v);
                        void savePrivacyToggle({ profileViewPrivacy: v });
                      }}
                    />
                  </View>
                </View>
              </LinearGradient>
            </>
          ) : null}

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.blockedSectionHeading}>
                Blocked accounts <Text style={styles.blockedCount}>({blocks.length})</Text>
              </Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          {blocks.length === 0 ? (
            <LinearGradient
              colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardOuter}
            >
              <View style={styles.emptyInner}>
                <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.emptyIconGrad}>
                  <Ionicons name="hand-left-outline" size={26} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No blocks yet</Text>
                <Text style={styles.emptySub}>People you block stay hidden from your feed and discovery.</Text>
              </View>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardOuter}
            >
              <View style={styles.cardInner}>
                {blocks.map((item, index) => (
                  <View
                    key={item.blocked_id}
                    style={[styles.blockRow, index === blocks.length - 1 && styles.blockRowLast]}
                  >
                    <View style={styles.blockRowLeft}>
                      <View style={styles.blockIconCircle}>
                        <Ionicons name="person-remove-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.blockTextCol}>
                        <Text style={styles.blockId}>{item.blocked_id.slice(0, 8)}…</Text>
                        <Text style={styles.blockHint}>Blocked account</Text>
                      </View>
                    </View>
                    <Text style={styles.blockDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          )}

          <Text style={styles.note}>
            Data usage: LinkUp uses your location for nearby plans, verification media for KYC, and messages for
            delivery. See product privacy copy in docs.
          </Text>
    </SettingsStickyShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 52,
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
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  helpCtaOuter: {
    marginHorizontal: spacing.md,
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#6C63FF',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 14,
        }
      : { elevation: 5 }),
  },
  helpCtaPressed: { opacity: 0.94, transform: [{ scale: 0.98 }] },
  helpCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  helpCtaTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  sectionHead: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
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
  blockedSectionHeading: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  blockedCount: {
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  cardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  cardInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  emptyInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  emptyIconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 29, 38, 0.08)',
  },
  blockRowLast: { borderBottomWidth: 0 },
  blockRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  blockIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  blockTextCol: { flex: 1, minWidth: 0 },
  blockId: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  blockHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  blockDate: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  prefRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 29, 38, 0.08)',
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  prefTextCol: { flex: 1, minWidth: 0 },
  prefLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  prefSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
  note: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
