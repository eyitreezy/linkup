/**
 * Public member profile — opened from plan feed avatars (inbox-grade shell).
 */
import { TierBadge } from '@/components/TierBadge';
import { Screen } from '@/components/Screen';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { openDirectChat } from '@/lib/messaging/openDirectChat';
import { HostMediaGallery } from '@/components/plans/HostMediaGallery';
import { derivePresenceUi } from '@/lib/presence/derivePresenceUi';
import {
  fetchViewerPrivacyPrefs,
  shouldSkipProfileViewRecording,
} from '@/lib/plans/incognitoEngagement';
import { resolveProfileHeroPhoto } from '@/lib/profile/displayMedia';
import { buildHostMediaSequence } from '@/lib/profile/media/buildHostMediaSequence';
import { fetchProfileVideo, type ProfileVideoRecord } from '@/lib/profile/media/profileVideo';
import { fetchUserPresence, subscribeUserPresenceRealtime } from '@/lib/presence/subscribeUserPresenceRealtime';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbProfile, DbUserPresence } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function InboxGradientBg() {
  return (
    <LinearGradient
      colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
      locations={[0, 0.32, 0.62, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadRow}>
        <View style={styles.sectionDot} />
        <Text style={styles.sectionLabel}>{title}</Text>
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

export default function PublicUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile: viewerProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [theirPresence, setTheirPresence] = useState<DbUserPresence | null>(null);
  const [profileVideo, setProfileVideo] = useState<ProfileVideoRecord | null>(null);
  const [chatBusy, setChatBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: p, error: pe } = await supabase.from('profiles').select('*').eq('user_id', id).maybeSingle();
    if (pe || !p) {
      setProfile(null);
    } else {
      const row = p as DbProfile;
      setProfile(row);
      const video = await fetchProfileVideo(row.user_id);
      setProfileVideo(video);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured || !user?.id || user.id === id || !profile || profile.is_profile_public === false) return;
    void (async () => {
      const prefs = await fetchViewerPrivacyPrefs(supabase, user.id);
      if (shouldSkipProfileViewRecording(prefs)) return;
      await supabase.from('profile_views').insert({ viewer_id: user.id, viewed_user_id: id });
    })();
  }, [id, user?.id, profile?.user_id, profile?.is_profile_public]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured || !user?.id || user.id === id) {
      setTheirPresence(null);
      return;
    }

    let cancelled = false;
    void fetchUserPresence(id).then((row) => {
      if (!cancelled) setTheirPresence(row);
    });

    const unsubscribe = subscribeUserPresenceRealtime(id, (row) => {
      if (!cancelled) setTheirPresence(row);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id, user?.id]);

  const presenceUi = useMemo(
    () => derivePresenceUi(viewerProfile, profile?.preferences, theirPresence),
    [viewerProfile, profile?.preferences, theirPresence]
  );

  const isSelf = !!(user?.id && id && user.id === id);
  const canInteract = !!(user?.id && id && !isSelf);

  const mediaItems = useMemo(
    () => buildHostMediaSequence(profile, profileVideo),
    [profile, profileVideo]
  );

  async function onMessage() {
    if (!user?.id || !id || chatBusy) return;
    setChatBusy(true);
    try {
      await openDirectChat(supabase, user.id, id);
    } catch (e) {
      Alert.alert('Chat', e instanceof Error ? e.message : 'Could not open chat');
    } finally {
      setChatBusy(false);
    }
  }

  function onBlock() {
    if (!user?.id || !id) return;
    Alert.alert('Block this person?', 'You will not see their plans in your feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            const { error } = await supabase.from('user_blocks').insert({
              blocker_id: user.id,
              blocked_id: id,
            });
            if (error) Alert.alert('Block', error.message);
            else {
              Alert.alert('Blocked');
              router.back();
            }
          })(),
      },
    ]);
  }

  if (loading) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <InboxGradientBg />
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </View>
      </Screen>
    );
  }

  if (!profile || profile.is_profile_public === false) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
        <View style={styles.flex}>
          <InboxGradientBg />
          <View style={styles.topNav}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.unavailableCard}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
            <Text style={styles.unavailableTitle}>Profile unavailable</Text>
            <Text style={styles.unavailableSub}>This member has a private profile or the link is no longer valid.</Text>
          </View>
        </View>
      </Screen>
    );
  }

  const name = profile.display_name?.trim() || 'Member';
  const verified = !!profile.verified_badge;

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <InboxGradientBg />

        <View style={styles.topNav}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        <HostMediaGallery items={mediaItems} loading={loading} edgeToEdge />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Member</Text>
              <Text style={styles.leadTitle} numberOfLines={2}>
                {name}
              </Text>
              {profile.subscription_badge ? (
                <View style={styles.tierBadgeRow}>
                  <TierBadge tier={profile.subscription_badge} />
                </View>
              ) : null}
              <Text style={styles.leadSub}>
                {isSelf
                  ? 'This is how others see your public profile on LinkUp.'
                  : 'Public profile from the feed — verify badges and presence update live.'}
              </Text>
            </View>
          </View>

          <View style={styles.profileCard}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                <AvatarWithPresence
                  uri={resolveProfileHeroPhoto(profile)}
                  name={name}
                  size={104}
                  presence={presenceUi}
                  showDot={!isSelf}
                />
              </View>
            </LinearGradient>

            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{name}</Text>
              {verified ? (
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.verifiedPill}
                >
                  <Ionicons name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.verifiedPillTxt}>Verified</Text>
                </LinearGradient>
              ) : null}
            </View>

            {presenceUi.caption && !isSelf ? (
              <View style={styles.presenceRow}>
                <View
                  style={[
                    styles.presenceDot,
                    {
                      backgroundColor:
                        presenceUi.dot === 'online'
                          ? colors.success
                          : presenceUi.dot === 'offline'
                            ? '#94A3B8'
                            : colors.textMuted,
                    },
                  ]}
                />
                <Text style={styles.presenceCap}>{presenceUi.caption}</Text>
              </View>
            ) : null}

            <View style={styles.bioBlock}>
              <Text style={styles.bioLabel}>About</Text>
              {profile.bio ? (
                <Text style={styles.bio}>{profile.bio}</Text>
              ) : (
                <Text style={styles.bioMuted}>No bio yet.</Text>
              )}
            </View>
          </View>

          {canInteract ? (
            <>
              <SectionHead title="Connect" />
              <Pressable
                onPress={() => void onMessage()}
                disabled={chatBusy}
                style={({ pressed }) => [
                  styles.primaryCtaOuter,
                  chatBusy && { opacity: 0.65 },
                  pressed && !chatBusy && { opacity: 0.94, transform: [{ scale: 0.985 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Message ${name}`}
              >
                <LinearGradient
                  colors={chatBusy ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryCtaGrad}
                >
                  {chatBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryCtaTxt}>Message {name}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <SectionHead title="Safety" />
              <Pressable
                onPress={onBlock}
                style={({ pressed }) => [styles.blockOuter, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Block this person"
              >
                <View style={styles.blockInner}>
                  <Ionicons name="ban-outline" size={20} color={colors.danger} />
                  <Text style={styles.blockTxt}>Block</Text>
                </View>
              </Pressable>
              <Text style={styles.safetyFoot}>
                Blocking hides their plans from your feed. You can manage blocks in settings later.
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
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
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 34,
  },
  tierBadgeRow: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  avatarRing: {
    padding: 3,
    borderRadius: 58,
    marginBottom: spacing.md,
  },
  avatarInner: {
    borderRadius: 55,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.xs,
  },
  cardName: { fontSize: 22, fontWeight: '900', color: colors.text },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
  },
  verifiedPillTxt: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  presenceDot: { width: 8, height: 8, borderRadius: 4 },
  presenceCap: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  bioBlock: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.14)',
  },
  bioLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  bio: { fontSize: 16, lineHeight: 24, color: colors.text, fontWeight: '600' },
  bioMuted: { fontSize: 15, lineHeight: 22, color: colors.textMuted, fontStyle: 'italic', fontWeight: '600' },
  sectionHead: { marginBottom: spacing.sm, marginTop: spacing.xs },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: { height: 2, borderRadius: 1, opacity: 0.9 },
  primaryCtaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.26,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
    }),
  },
  primaryCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  primaryCtaTxt: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  blockOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  blockInner: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  blockTxt: { fontSize: 16, fontWeight: '800', color: colors.danger },
  safetyFoot: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  unavailableCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    gap: spacing.sm,
  },
  unavailableTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginTop: spacing.sm },
  unavailableSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
