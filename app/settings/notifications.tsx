import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { defaultVisibilityPrefs } from '@/lib/presence/visibilityPrefs';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ProfilePreferences } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

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

  useEffect(() => {
    setPush(prefs.push !== false);
    setEmail(prefs.email !== false);
  }, [profile?.preferences?.notifications]);

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
      const nextPrefs: ProfilePreferences = {
        ...(profile?.preferences ?? {}),
        notifications: { push: next.push, email: next.email },
        visibility,
      };
      const { error } = await supabase.from('profiles').update({ preferences: nextPrefs }).eq('user_id', user.id);
      if (error) Alert.alert('Error', error.message);
      else await refreshProfile();
    },
    [user, profile?.preferences, refreshProfile]
  );

  return (
    <Screen scroll>
      <Text style={styles.section}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Push notifications</Text>
          <Switch
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
            trackColor={{ true: colors.primary }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email updates</Text>
          <Switch
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
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      <Text style={styles.section}>Visibility</Text>
      <Text style={styles.sectionSub}>
        Control what others see. If you hide all activity status, you won&apos;t see others&apos; status either.
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Show online status</Text>
            <Text style={styles.hint}>Green dot when you&apos;re active in the app</Text>
          </View>
          <Switch
            value={showOnline}
            onValueChange={(v) => {
              setShowOnline(v);
              void saveAll({ push, email, showOnline: v, showLastSeen, readReceipts, shareTyping });
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Show last seen</Text>
            <Text style={styles.hint}>“Active recently” — never exact times</Text>
          </View>
          <Switch
            value={showLastSeen}
            onValueChange={(v) => {
              setShowLastSeen(v);
              void saveAll({ push, email, showOnline, showLastSeen: v, readReceipts, shareTyping });
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Read receipts</Text>
            <Text style={styles.hint}>Let others know when you&apos;ve read messages (when chat supports it)</Text>
          </View>
          <Switch
            value={readReceipts}
            onValueChange={(v) => {
              setReadReceipts(v);
              void saveAll({ push, email, showOnline, showLastSeen, readReceipts: v, shareTyping });
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Typing indicator</Text>
            <Text style={styles.hint}>Allow others to see when you&apos;re typing. You only see theirs if you keep this on.</Text>
          </View>
          <Switch
            value={shareTyping}
            onValueChange={(v) => {
              setShareTyping(v);
              void saveAll({ push, email, showOnline, showLastSeen, readReceipts, shareTyping: v });
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      <Text style={styles.note}>
        Presence updates are throttled to keep the app fast. Push and email delivery still need your backend hooks.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionSub: {
    fontSize: 14,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  note: { fontSize: 13, color: colors.textMuted, padding: spacing.lg, lineHeight: 20 },
});
