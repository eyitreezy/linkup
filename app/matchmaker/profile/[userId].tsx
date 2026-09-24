import { Button } from '@/components/Button';
import { HostMediaCarousel } from '@/components/plans/HostMediaCarousel';
import { MatchMakerProfilePrompts } from '@/components/matchmaker/MatchMakerProfilePrompts';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ageFromBirthDate, buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { expressMatchMakerInterest, passMatchMakerInterest } from '@/lib/matchmaker/pool';
import { fetchMatchMakerProfileBundle } from '@/lib/matchmaker/profile';
import { buildHostMediaSequence } from '@/lib/profile/media/buildHostMediaSequence';
import { goBackOrFallback } from '@/lib/navigation/goBackOrFallback';
import { VerificationBadge } from '@/components/trust/VerificationBadge';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function signalIcon(signal: string): keyof typeof Ionicons.glyphMap {
  const lower = signal.toLowerCase();
  if (lower.includes('communication') || lower.includes('contact')) return 'chatbubble-outline';
  if (lower.includes('family') || lower.includes('interest')) return 'people-outline';
  if (lower.includes('km') || lower.includes('based in') || lower.includes('close by')) {
    return 'location-outline';
  }
  return 'sparkles-outline';
}

export default function MatchMakerProfileScreen() {
  const { userId, distance_km: distanceKmParam } = useLocalSearchParams<{
    userId: string;
    distance_km?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { profile: viewerProfile } = useAuth();
  const heroHeight = Math.round(winH * 0.45);

  const distanceKm = useMemo(() => {
    if (distanceKmParam == null || distanceKmParam === '') return null;
    const n = Number(distanceKmParam);
    return Number.isFinite(n) ? n : null;
  }, [distanceKmParam]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchMatchMakerProfileBundle>> | null>(
    null
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatchMakerProfileBundle(userId, { distanceKm });
      setBundle(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [userId, distanceKm]);

  useEffect(() => {
    void load();
  }, [load]);

  const mediaItems = useMemo(
    () => (bundle ? buildHostMediaSequence(bundle.profile, bundle.video) : []),
    [bundle]
  );

  const signals = useMemo(
    () =>
      bundle
        ? buildCompatibilitySignals(bundle.poolProfile, viewerProfile?.communication_style)
        : [],
    [bundle, viewerProfile?.communication_style]
  );

  const interests = bundle?.poolProfile.interests ?? [];
  const age = ageFromBirthDate(bundle?.profile.birth_date);
  const name = bundle?.profile.display_name?.trim() || 'Member';

  async function onExpressInterest() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const result = await expressMatchMakerInterest(userId);
      if (result.matched && result.connection_id) {
        router.replace(`/matchmaker/connection/${result.connection_id}` as Href);
        return;
      }
      goBackOrFallback('/matchmaker' as Href);
    } catch (e) {
      Alert.alert('MatchMaker', e instanceof Error ? e.message : 'Could not express interest');
    } finally {
      setBusy(false);
    }
  }

  async function onPass() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await passMatchMakerInterest(userId);
      goBackOrFallback('/matchmaker' as Href);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} size="large" />
      </View>
    );
  }

  if (error || !bundle) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => goBackOrFallback('/matchmaker' as Href)}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Profile unavailable'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topNav, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => goBackOrFallback('/matchmaker' as Href)}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          {mediaItems.length > 0 ? (
            <HostMediaCarousel
              items={mediaItems}
              width={winW}
              height={heroHeight}
              showCounter
              interactive
            />
          ) : (
            <View style={[styles.heroFallback, { height: heroHeight }]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(253, 248, 244, 0.92)', MM.bg]}
            locations={[0.45, 0.78, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {name}
              {age != null ? `, ${age}` : ''}
            </Text>
            {bundle.profile.verified_badge ? <VerificationBadge verified variant="chip" /> : null}
          </View>
          {bundle.profile.location_label ? (
            <Text style={styles.location}>{bundle.profile.location_label}</Text>
          ) : null}

          {signals.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>What you have in common</Text>
              {signals.map((signal) => (
                <View key={signal} style={styles.signalRow}>
                  <View style={styles.signalIcon}>
                    <Ionicons name={signalIcon(signal)} size={16} color={MM.accent} />
                  </View>
                  <Text style={styles.signalText}>{signal}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {interests.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Interests</Text>
              <View style={styles.interestRow}>
                {interests.map((tag) => (
                  <View key={tag} style={styles.interestChip}>
                    <Text style={styles.interestText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <MatchMakerProfilePrompts preferences={bundle.profile.preferences} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={() => void onPass()}
          disabled={busy}
          style={({ pressed }) => [styles.passBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.passText}>Pass</Text>
        </Pressable>
        <Button
          title="Express Interest"
          onPress={() => void onExpressInterest()}
          loading={busy}
          gradient
          pill
          style={styles.interestBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  topNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(237, 224, 212, 0.9)',
  },
  hero: {
    width: '100%',
    backgroundColor: MM.surfaceWarm,
    overflow: 'hidden',
  },
  heroFallback: {
    width: '100%',
    backgroundColor: MM.surfaceWarm,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: MM.text,
    letterSpacing: -0.3,
  },
  location: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: MM.muted,
    marginTop: -spacing.sm,
  },
  sectionCard: {
    backgroundColor: MM.surfaceWarm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionBlock: { gap: spacing.sm },
  sectionHeading: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: MM.text,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signalIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(155, 27, 75, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: MM.text,
    lineHeight: 20,
  },
  interestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: MM.surface,
    borderWidth: 1,
    borderColor: MM.border,
    borderRadius: radius.button,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  interestText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: MM.text,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: MM.bg,
    borderTopWidth: 1,
    borderTopColor: MM.border,
  },
  passBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  passText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: MM.muted,
  },
  interestBtn: { flex: 1 },
  errorText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: MM.muted,
    textAlign: 'center',
  },
});
