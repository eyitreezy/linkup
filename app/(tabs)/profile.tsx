/**
 * AC1 — Profile hub: identity, stats, Premium upsell, settings list.
 */
import { LogoutConfirmModal } from '@/components/profile/LogoutConfirmModal';
import { PremiumCard } from '@/components/profile/PremiumCard';
import { ProfilePromptShowcase } from '@/components/profile/ProfilePromptShowcase';
import { ProfileSettingsRow } from '@/components/profile/ProfileSettingsRow';
import { ProfileUserHeader } from '@/components/profile/ProfileUserHeader';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationInbox } from '@/contexts/NotificationInboxContext';
import { profileCompletionPercent } from '@/lib/profile/profileCompletionPercent';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { isUserVerified } from '@/lib/verification/access';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { useTabBarScrollProps } from '@/hooks/useTabBarScrollHandler';
import { Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SettingsSectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadRow}>
        <View style={styles.sectionAccentDot} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <LinearGradient
        colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionRule}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const tabBarScroll = useTabBarScrollProps();
  const insets = useSafeAreaInsets();
  const { user, profile, dbUser, signOut, isAdmin, refreshProfile } = useAuth();
  const { unreadCount } = useNotificationInbox();
  const [plansCreated, setPlansCreated] = useState<number | null>(null);
  const [plansDone, setPlansDone] = useState<number | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const verified = !!(dbUser && isUserVerified(dbUser.verification_status));
  const completion = profileCompletionPercent(profile ?? null, verified);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), loadStats()]);
    setRefreshing(false);
  }, [refreshProfile, loadStats]);

  const name = profile?.display_name?.trim() || user?.email?.split('@')[0] || 'You';

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={styles.profileHeader}>
          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Account</Text>
              <Text style={styles.leadTitle}>Your profile</Text>
              <Text style={styles.leadSub}>
                Your name, verification, and visibility in one place.
              </Text>
            </View>
          </View>
        </View>

        <Animated.ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xl * 2 + 72,
            },
          ]}
          showsVerticalScrollIndicator={false}
          {...tabBarScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <LinearGradient
            colors={['rgba(108,99,255,0.16)', 'rgba(255,101,132,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerShell}
          >
            <View style={styles.headerInner}>
              <ProfileUserHeader
                name={name}
                avatarUrl={profile?.avatar_url ?? null}
                email={user?.email}
                verified={verified}
                showPremium={subscriber}
              />
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.trustShell}
          >
            <View style={styles.trustInner}>
              <View style={styles.trustStrip}>
                <View style={styles.trustCol}>
                  <Text style={styles.trustLabel}>Profile</Text>
                  <Text style={styles.trustValue}>{completion}%</Text>
                  <Text style={styles.trustHint}>complete</Text>
                </View>
                <View style={styles.trustDivider} />
                <View style={styles.trustCol}>
                  <Text style={styles.trustLabel}>Verification</Text>
                  <Text style={[styles.trustValue, !verified && styles.trustValueMuted]}>
                    {verified ? 'On' : 'Off'}
                  </Text>
                  <Text style={styles.trustHint}>{verified ? 'others see the badge' : 'add in settings'}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <ProfilePromptShowcase preferences={profile?.preferences} />

          <LinearGradient
            colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statsShell}
          >
            <View style={styles.statsInner}>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{plansCreated ?? '—'}</Text>
                  <Text style={styles.statLabel}>Meetups shared</Text>
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
            </View>
          </LinearGradient>

          <PremiumCard
            onUpgrade={() => router.push('/premium' as Href)}
            isSubscriber={subscriber}
            premiumUntilLabel={premiumLabel}
          />

          <SettingsSectionHeader title="Settings & account" />
          <LinearGradient
            colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.settingsShell}
          >
            <View style={styles.settingsInner}>
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
                subtitle="Meetups, escrow, verification"
                badgeCount={unreadCount}
                onPress={() => router.push('/notifications' as Href)}
              />
              {(plansCreated ?? 0) > 0 ? (
                <ProfileSettingsRow
                  icon="albums-outline"
                  label="Plan management"
                  subtitle="Your meetups, mood shelf, drafts"
                  onPress={() => router.push('/settings/plan-management' as Href)}
                />
              ) : null}
              <ProfileSettingsRow
                icon="wallet-outline"
                label="Wallet & credits"
                subtitle="Balance, refunds, goodwill"
                onPress={() => router.push('/wallet' as Href)}
              />
              <ProfileSettingsRow
                icon="notifications-outline"
                label="Notifications & visibility"
                onPress={() => router.push('/settings/notifications' as Href)}
              />
              <ProfileSettingsRow
                icon="lock-closed-outline"
                label="Privacy & safety"
                onPress={() => router.push('/settings/privacy' as Href)}
              />
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
                isLast
              />
            </View>
          </LinearGradient>
        </Animated.ScrollView>

        <LogoutConfirmModal visible={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  profileHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  scroll: { paddingTop: spacing.xs },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
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
  headerShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  headerInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    paddingVertical: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  trustShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  trustInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
  },
  trustStrip: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'stretch',
  },
  trustCol: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
  trustDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(26, 29, 38, 0.08)', marginVertical: 4 },
  trustLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trustValue: { fontSize: 22, fontWeight: '900', color: colors.primary, marginTop: 4 },
  trustValueMuted: { color: colors.textMuted },
  trustHint: { fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  statsShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  statsInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  sectionHead: {
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
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
  settingsShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  settingsInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
});
