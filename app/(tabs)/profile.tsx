/**
 * AC1 — Profile hub: identity, stats, Premium upsell, settings list (linkup-web parity).
 */
import { LogoutConfirmModal } from '@/components/profile/LogoutConfirmModal';
import { PremiumCard } from '@/components/profile/PremiumCard';
import { ProfileIdentityCard } from '@/components/profile/ProfileIdentityCard';
import { ProfilePromptShowcase } from '@/components/profile/ProfilePromptShowcase';
import { ProfileSettingsRow } from '@/components/profile/ProfileSettingsRow';
import { ProfileSpotlightCard } from '@/components/profile/ProfileSpotlightCard';
import { ProfileVerificationCard } from '@/components/profile/ProfileVerificationCard';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationInbox } from '@/contexts/NotificationInboxContext';
import { profileCompletionPercent } from '@/lib/profile/profileCompletionPercent';
import { effectiveSubscriptionTier } from '@/lib/premium/access';
import { isUserVerified } from '@/lib/verification/access';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Href, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFullBleedAbsoluteFillStyle } from '@/hooks/useFullBleedAbsoluteFillStyle';
import { useCallback, useEffect, useState } from 'react';
import { useTabBarScrollProps } from '@/hooks/useTabBarScrollHandler';
import { Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

function SettingsSectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadRow}>
        <View style={styles.sectionAccentDot} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <LinearGradient
        colors={['rgba(94, 82, 255,0.35)', 'rgba(255, 74, 114,0.2)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionRule}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const tabBarScroll = useTabBarScrollProps();
  const bleedBgStyle = useFullBleedAbsoluteFillStyle();
  const { user, profile, dbUser, signOut, isAdmin, refreshProfile } = useAuth();
  const { unreadCount } = useNotificationInbox();
  const [plansCreated, setPlansCreated] = useState<number | null>(null);
  const [plansDone, setPlansDone] = useState<number | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const verified = !!(dbUser && isUserVerified(dbUser.verification_status));
  const completion = profileCompletionPercent(profile ?? null, verified);
  const subscriptionTier = effectiveSubscriptionTier(dbUser);

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
          colors={['#D2C9FF', '#FFD1E3', '#B8EDD9', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={bleedBgStyle}
          pointerEvents="none"
        />

        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <LinearGradient
              colors={[colors.primary, '#8B7CFF', colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadge}
            >
              <Ionicons name="person" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.heroText}>
              <Text style={styles.heroKicker}>Account</Text>
              <Text style={styles.heroTitle}>Your profile</Text>
              <Text style={styles.heroSub}>
                Your name, verification, and visibility in one place.
              </Text>
            </View>
          </View>
        </View>

        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          {...tabBarScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <ProfileIdentityCard
            profile={profile}
            name={name}
            email={user?.email}
            verified={verified}
            subscriptionTier={subscriptionTier}
            completionPercent={completion}
          />

          <ProfileVerificationCard verificationStatus={dbUser?.verification_status} />

          <ProfileSpotlightCard />

          <LinearGradient
            colors={[colors.primary, '#8B7CFF', colors.secondary]}
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
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{plansDone ?? '—'}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, styles.statMuted]}>—</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {profile?.bio?.trim() ? (
            <LinearGradient
              colors={['rgba(94, 82, 255,0.14)', 'rgba(255, 74, 114,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bioShell}
            >
              <View style={styles.bioInner}>
                <Text style={styles.bioKicker}>About</Text>
                <Text style={styles.bioText}>{profile.bio.trim()}</Text>
              </View>
            </LinearGradient>
          ) : null}

          <ProfilePromptShowcase preferences={profile?.preferences} />

          <PremiumCard
            dbUser={dbUser}
            onUpgrade={() => router.push('/subscription' as Href)}
          />

          <SettingsSectionHeader title="Settings & account" />
          <LinearGradient
            colors={[colors.primary, '#8B7CFF', colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.settingsShell}
          >
            <View style={styles.settingsInner}>
              <ProfileSettingsRow
                icon="diamond-outline"
                label="Subscription"
                onPress={() => router.push('/subscription' as Href)}
              />
              <ProfileSettingsRow
                icon="create-outline"
                label="Edit profile"
                onPress={() => router.push('/settings/edit-profile' as Href)}
              />
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

        <LogoutConfirmModal
          visible={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          onConfirm={async () => {
            await signOut();
            router.replace('/(auth)/login' as Href);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  heroHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.7,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 21,
  },
  scroll: {
    paddingBottom: 120,
  },
  statsShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  statsInner: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl - 1,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(26, 29, 38, 0.1)',
    marginVertical: 6,
  },
  statNum: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  statMuted: { color: colors.textMuted },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  bioShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  bioInner: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl - 1,
    padding: spacing.lg,
  },
  bioKicker: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bioText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
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
    fontFamily: fonts.bold,
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
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl - 1,
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
