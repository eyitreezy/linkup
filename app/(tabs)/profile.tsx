/**
 * AC1 — Profile hub: identity, stats, Premium upsell, settings list.
 */
import { LogoutConfirmModal } from '@/components/profile/LogoutConfirmModal';
import { PremiumCard } from '@/components/profile/PremiumCard';
import { ProfileSettingsRow } from '@/components/profile/ProfileSettingsRow';
import { ProfileUserHeader } from '@/components/profile/ProfileUserHeader';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationInbox } from '@/contexts/NotificationInboxContext';
import { getVisibilityPrefs } from '@/lib/presence/visibilityPrefs';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { isUserVerified } from '@/lib/verification/access';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  const { user, profile, dbUser, signOut, isAdmin, refreshProfile } = useAuth();
  const { unreadCount } = useNotificationInbox();
  const [plansCreated, setPlansCreated] = useState<number | null>(null);
  const [plansDone, setPlansDone] = useState<number | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const verified = !!(dbUser && isUserVerified(dbUser.verification_status));
  const subscriber = isPremiumSubscriber(dbUser);
  const premiumLabel = dbUser?.premium_until
    ? new Date(dbUser.premium_until).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null;

  const loadStats = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) return;
    const { count: c1 } = await supabase
      .from('plans')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', user.id);
    const { count: c2 } = await supabase
      .from('plans')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', user.id)
      .eq('status', 'completed');
    setPlansCreated(c1 ?? 0);
    setPlansDone(c2 ?? 0);
  }, [user?.id]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const name = profile?.display_name?.trim() || user?.email?.split('@')[0] || 'You';
  const vis = getVisibilityPrefs(profile);
  const activityHint =
    !vis.show_online_status && !vis.show_last_seen
      ? 'Activity hidden from others'
      : "Others may see when you're active — change in Notifications & visibility";

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ProfileUserHeader
          name={name}
          avatarUrl={profile?.avatar_url ?? null}
          email={user?.email}
          verified={verified}
          activityHint={activityHint}
        />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{plansCreated ?? '—'}</Text>
            <Text style={styles.statLabel}>Plans created</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{plansDone ?? '—'}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>—</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <PremiumCard
          onUpgrade={() => router.push('/premium' as Href)}
          isSubscriber={subscriber}
          premiumUntilLabel={premiumLabel}
        />

        <Text style={styles.section}>Settings & account</Text>
        <View style={styles.card}>
          <ProfileSettingsRow icon="create-outline" label="Edit profile" onPress={() => router.push('/settings/edit-profile' as Href)} />
          <ProfileSettingsRow
            icon="shield-checkmark-outline"
            label="Verification status"
            subtitle={dbUser?.verification_status}
            onPress={() => router.push('/settings/verification' as Href)}
          />
          <ProfileSettingsRow
            icon="mail-unread-outline"
            label="Notification inbox"
            subtitle="Offers, escrow, verification"
            badgeCount={unreadCount}
            onPress={() => router.push('/notifications' as Href)}
          />
          <ProfileSettingsRow
            icon="notifications-outline"
            label="Notifications & visibility"
            onPress={() => router.push('/settings/notifications' as Href)}
          />
          <ProfileSettingsRow icon="lock-closed-outline" label="Privacy & safety" onPress={() => router.push('/settings/privacy' as Href)} />
          <ProfileSettingsRow
            icon="airplane-outline"
            label="Travel mode"
            subtitle="Premium"
            onPress={() => router.push('/settings/travel' as Href)}
          />
          <ProfileSettingsRow icon="help-circle-outline" label="Help & support" onPress={() => router.push('/support' as Href)} />
          <ProfileSettingsRow icon="git-merge-outline" label="Disputes" onPress={() => router.push('/disputes' as Href)} />
          {isAdmin ? (
            <ProfileSettingsRow icon="speedometer-outline" label="Admin dashboard" onPress={() => router.push('/admin' as Href)} />
          ) : null}
          <ProfileSettingsRow icon="log-out-outline" label="Log out" onPress={() => setLogoutOpen(true)} />
          <ProfileSettingsRow
            icon="trash-outline"
            label="Delete account"
            onPress={() => router.push('/settings/delete-account' as Href)}
            danger
          />
        </View>

        <Text
          style={styles.refresh}
          onPress={() => void refreshProfile()}
          accessibilityRole="button"
        >
          Refresh profile data
        </Text>
      </ScrollView>

      <LogoutConfirmModal
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void signOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl * 2 },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  refresh: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    padding: spacing.md,
  },
});
