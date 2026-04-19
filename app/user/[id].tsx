/**
 * Public member profile — opened from plan feed avatars.
 */
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { derivePresenceUi } from '@/lib/presence/derivePresenceUi';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbProfile, DbUserPresence } from '@/types/database';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

export default function PublicUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile: viewerProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [theirPresence, setTheirPresence] = useState<DbUserPresence | null>(null);

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
      setProfile(p as DbProfile);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured || !user?.id || user.id === id) {
      setTheirPresence(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('user_presence').select('*').eq('user_id', id).maybeSingle();
      if (!cancelled && data) setTheirPresence(data as DbUserPresence);
    })();
    const ch = supabase
      .channel(`public-presence:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence', filter: `user_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          setTheirPresence(payload.new as DbUserPresence);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [id, user?.id]);

  const presenceUi = useMemo(
    () => derivePresenceUi(viewerProfile, profile?.preferences, theirPresence),
    [viewerProfile, profile?.preferences, theirPresence]
  );

  if (loading) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!profile || profile.is_profile_public === false) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.unavailable}>This profile is not available.</Text>
      </Screen>
    );
  }

  const name = profile.display_name?.trim() || 'Member';
  const verified = !!profile.verified_badge;

  return (
    <Screen scroll safeAreaEdges={['top', 'left', 'right']}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
        <Text style={styles.backTxt}>← Back</Text>
      </Pressable>
      <View style={styles.hero}>
        <AvatarWithPresence
          uri={profile.avatar_url}
          name={name}
          size={112}
          presence={presenceUi}
          showDot={user?.id !== id}
        />
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {verified ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>Verified</Text>
            </View>
          ) : null}
        </View>
        {presenceUi.caption ? <Text style={styles.presenceCap}>{presenceUi.caption}</Text> : null}
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : <Text style={styles.muted}>No bio yet.</Text>}
        {user && id && user.id !== id ? (
          <Button
            title="Block"
            variant="ghost"
            onPress={() => {
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
            }}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  back: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backTxt: { fontSize: 16, fontWeight: '700', color: colors.primary },
  unavailable: { padding: spacing.lg, fontSize: 16, color: colors.textMuted },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  presenceCap: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  name: { fontSize: 26, fontWeight: '800', color: colors.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  badgeTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  bio: { marginTop: spacing.md, fontSize: 16, lineHeight: 24, color: colors.text },
  muted: { marginTop: spacing.md, fontSize: 15, color: colors.textMuted, fontStyle: 'italic' },
});
