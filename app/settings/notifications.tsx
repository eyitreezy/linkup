import { UpgradePrompt } from '@/components/UpgradePrompt';
import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { syncExpoPushTokenForUser } from '@/lib/notifications/registerPushNotifications';
import { defaultVisibilityPrefs } from '@/lib/presence/visibilityPrefs';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ProfilePreferences } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { checkPermission } from '@/lib/subscription/checkPermission';
import type { SubscriptionTier } from '@/types/database';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

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

export default function NotificationsSettingsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const prefs = profile?.preferences?.notifications ?? {};

  const v0 = defaultVisibilityPrefs();
  const [push, setPush] = useState(prefs.push !== false);
  const [email, setEmail] = useState(prefs.email !== false);
  const [showOnline, setShowOnline] = useState(v0.show_online_status);
  const [showLastSeen, setShowLastSeen] = useState(v0.show_last_seen);
  const [readReceipts, setReadReceipts] = useState(v0.read_receipts);
  const [shareTyping, setShareTyping] = useState(v0.share_typing_indicator);
  const [readReceiptsUpgradeOpen, setReadReceiptsUpgradeOpen] = useState(false);
  const [readReceiptsUpgradeTier, setReadReceiptsUpgradeTier] = useState<SubscriptionTier>('SILVER');

  useEffect(() => {
    setPush(prefs.push !== false);
    setEmail(prefs.email !== false);
  }, [profile?.preferences?.notifications]);

  useEffect(() => {
    if (!user?.id || prefs.push === false) return;
    void syncExpoPushTokenForUser(user.id, true);
  }, [user?.id, prefs.push]);

  useEffect(() => {
    const v = profile?.preferences?.visibility;
    setShowOnline(v?.show_online_status !== false);
    setShowLastSeen(v?.show_last_seen !== false);
    setReadReceipts(v?.read_receipts !== false);
    setShareTyping(v?.share_typing_indicator !== false);
  }, [profile?.preferences?.visibility]);

  const saveAll = useCallback(
    async (next: {
      push: boolean;
      email: boolean;
      showOnline: boolean;
      showLastSeen: boolean;
      readReceipts: boolean;
      shareTyping: boolean;
    }) => {
      if (!user || !isSupabaseConfigured) return;
      const visibility: NonNullable<ProfilePreferences['visibility']> = {
        ...defaultVisibilityPrefs(),
        ...(profile?.preferences?.visibility ?? {}),
        show_online_status: next.showOnline,
        show_last_seen: next.showLastSeen,
        read_receipts: next.readReceipts,
        share_typing_indicator: next.shareTyping,
      };
      const base = profile?.preferences ?? {};
      const nextPrefs: ProfilePreferences = {
        ...base,
        notifications: { push: next.push, email: next.email },
        visibility,
        expo_push_token: base.expo_push_token ?? profile?.expo_push_token ?? undefined,
        expo_push_token_updated_at:
          base.expo_push_token_updated_at ?? profile?.expo_push_token_updated_at ?? undefined,
      };
      const { error } = await supabase
        .from('profiles')
        .update({
          preferences: nextPrefs,
          ...(nextPrefs.expo_push_token
            ? {
                expo_push_token: nextPrefs.expo_push_token,
                expo_push_token_updated_at: nextPrefs.expo_push_token_updated_at ?? null,
              }
            : {}),
        })
        .eq('user_id', user.id);
      if (error) Alert.alert('Error', error.message);
      else {
        if (next.push) void syncExpoPushTokenForUser(user.id, true);
        await refreshProfile();
      }
    },
    [user, profile?.preferences, refreshProfile]
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
              <Text style={styles.leadKicker}>Preferences</Text>
              <Text style={styles.leadTitle}>Notifications & visibility</Text>
              <Text style={styles.leadSub}>
                Define how we notify you and how you present yourself to everyone on LinkUp.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Notifications</Text>
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
              <View style={styles.row}>
                <Text style={styles.label}>Push notifications</Text>
                <PrefSwitch
                  value={push}
                  onValueChange={(v) => {
                    setPush(v);
                    void saveAll({
                      push: v,
                      email,
                      showOnline,
                      showLastSeen,
                      readReceipts,
                      shareTyping,
                    });
                  }}
                />
              </View>
              <View style={[styles.row, styles.rowLast]}>
                <Text style={styles.label}>Email updates</Text>
                <PrefSwitch
                  value={email}
                  onValueChange={(v) => {
                    setEmail(v);
                    void saveAll({
                      push,
                      email: v,
                      showOnline,
                      showLastSeen,
                      readReceipts,
                      shareTyping,
                    });
                  }}
                />
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Visibility</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>
          <Text style={styles.sectionSub}>
            Control what others see. If you hide all activity status, you won&apos;t see others&apos; status either.
          </Text>

          <LinearGradient
            colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardOuter}
          >
            <View style={styles.cardInner}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Show online status</Text>
                  <Text style={styles.hint}>Green dot when you&apos;re active in the app</Text>
                </View>
                <PrefSwitch
                  value={showOnline}
                  onValueChange={(v) => {
                    setShowOnline(v);
                    void saveAll({ push, email, showOnline: v, showLastSeen, readReceipts, shareTyping });
                  }}
                />
              </View>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Show last seen</Text>
                  <Text style={styles.hint}>“Active recently” — never exact times</Text>
                </View>
                <PrefSwitch
                  value={showLastSeen}
                  onValueChange={(v) => {
                    setShowLastSeen(v);
                    void saveAll({ push, email, showOnline, showLastSeen: v, readReceipts, shareTyping });
                  }}
                />
              </View>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Read receipts</Text>
                  <Text style={styles.hint}>Let others know when you&apos;ve read messages (when chat supports it)</Text>
                </View>
                <PrefSwitch
                  value={readReceipts}
                  onValueChange={(v) => {
                    if (v && user?.id) {
                      void checkPermission(user.id, 'messaging.read_receipts').then((perm) => {
                        if (!perm.allowed) {
                          setReadReceiptsUpgradeTier(perm.upgradeTo ?? 'SILVER');
                          setReadReceiptsUpgradeOpen(true);
                          return;
                        }
                        setReadReceipts(true);
                        void saveAll({ push, email, showOnline, showLastSeen, readReceipts: true, shareTyping });
                      });
                      return;
                    }
                    setReadReceipts(v);
                    void saveAll({ push, email, showOnline, showLastSeen, readReceipts: v, shareTyping });
                  }}
                />
              </View>
              <View style={[styles.row, styles.rowLast]}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Typing indicator</Text>
                  <Text style={styles.hint}>
                    Allow others to see when you&apos;re typing. You only see theirs if you keep this on.
                  </Text>
                </View>
                <PrefSwitch
                  value={shareTyping}
                  onValueChange={(v) => {
                    setShareTyping(v);
                    void saveAll({ push, email, showOnline, showLastSeen, readReceipts, shareTyping: v });
                  }}
                />
              </View>
            </View>
          </LinearGradient>

      <UpgradePrompt
        visible={readReceiptsUpgradeOpen}
        feature="messaging.read_receipts"
        requiredTier={readReceiptsUpgradeTier}
        onUpgrade={() => {
          setReadReceiptsUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setReadReceiptsUpgradeOpen(false)}
      />
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
  sectionHead: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionHeadSpaced: {
    marginTop: spacing.md,
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
  sectionSub: {
    fontSize: 14,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    lineHeight: 20,
    fontWeight: '600',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 29, 38, 0.08)',
    gap: spacing.md,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  label: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18, fontWeight: '600' },
});
