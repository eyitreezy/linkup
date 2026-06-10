import { LocationSearchField } from '@/components/location/LocationSearchField';
import {
  TravelModeFeedbackModal,
  type TravelModeFeedback,
} from '@/components/settings/TravelModeFeedbackModal';
import { Screen } from '@/components/Screen';
import type { LocationSuggestion } from '@/lib/location/locationGeocode';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const PRESETS = [
  { label: 'Lagos', latitude: 6.5244, longitude: 3.3792 },
  { label: 'Abuja', latitude: 9.0765, longitude: 7.3986 },
  { label: 'Port Harcourt', latitude: 4.8156, longitude: 7.0498 },
] as const;

const PAYWALL_POINTS = [
  'Browse meetups as if you were visiting another city.',
  'Plans and distances use your travel pin until you turn it off.',
  'Your home base stays saved in your profile. Turn travel mode off anytime.',
];

export default function TravelModeScreen() {
  const { user, profile, dbUser, refreshProfile } = useAuth();
  const { allowed: canTravelMode, loading: permLoading } = usePermission('discover.travel_mode');
  const tm = profile?.preferences?.travel_mode;
  const [searchQuery, setSearchQuery] = useState(tm?.label ?? '');
  const [feedback, setFeedback] = useState<TravelModeFeedback | null>(null);

  useEffect(() => {
    setSearchQuery(tm?.label ?? '');
  }, [tm?.label]);

  const save = useCallback(
    async (next: { label: string; latitude: number; longitude: number } | null) => {
      if (!user || !isSupabaseConfigured) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          preferences: {
            ...(profile?.preferences ?? {}),
            travel_mode: next,
          },
        })
        .eq('user_id', user.id);
      if (error) setFeedback({ kind: 'error', message: error.message });
      else {
        await refreshProfile();
        setFeedback(next ? { kind: 'saved', label: next.label } : { kind: 'cleared' });
      }
    },
    [user, profile?.preferences, refreshProfile]
  );

  const onPickLocation = useCallback(
    (s: LocationSuggestion) => {
      setSearchQuery(s.label);
      void save({ label: s.label, latitude: s.latitude, longitude: s.longitude });
    },
    [save]
  );

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <TravelModeFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
      <View style={styles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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
            <View style={styles.topNavSpacer} />
          </View>

          {!permLoading && !canTravelMode ? (
            <>
              <View style={styles.leadBlock}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.leadAccent}
                />
                <View style={styles.leadTextCol}>
                  <Text style={styles.leadKicker}>Premium</Text>
                  <Text style={styles.leadTitle}>Travel mode</Text>
                  <Text style={styles.leadSub}>
                    Drop a pin in another city to browse plans like a local. Ideal for upcoming trips or checking out a
                    new spot before you go.
                  </Text>
                </View>
              </View>

              <LinearGradient
                colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardOuter}
              >
                <View style={styles.cardInner}>
                  <View style={styles.paywallHero}>
                    <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.paywallIconGrad}>
                      <Ionicons name="airplane-outline" size={28} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.paywallHeroTitle}>Explore anywhere</Text>
                    <Text style={styles.paywallHeroSub}>Unlock travel mode with LinkUp Premium.</Text>
                  </View>
                  {PAYWALL_POINTS.map((line) => (
                    <View key={line} style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{line}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>

              <View style={styles.ctaWrap}>
                <Pressable
                  onPress={() => router.push('/subscription' as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="See Premium plans"
                  style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                >
                  <LinearGradient
                    colors={[colors.primary, '#8B7CE8', colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGrad}
                  >
                    <Text style={styles.ctaLabel}>See Premium</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.leadBlock}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.leadAccent}
                />
                <View style={styles.leadTextCol}>
                  <Text style={styles.leadKicker}>Location</Text>
                  <Text style={styles.leadTitle}>Travel mode</Text>
                  <Text style={styles.leadSub}>
                    The Plans tab uses this pin while travel mode is on. Search any city or area, or tap a quick preset.
                  </Text>
                </View>
              </View>

              {tm?.label ? (
                <LinearGradient
                  colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.cardOuter, styles.activeCardOuter]}
                >
                  <View style={styles.activeCardInner}>
                    <Ionicons name="airplane" size={20} color={colors.primary} />
                    <View style={styles.activeCardTextCol}>
                      <Text style={styles.activeCardLabel}>Currently browsing</Text>
                      <Text style={styles.activeCardPlace} numberOfLines={2}>
                        {tm.label}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              ) : null}

              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadRow}>
                  <View style={styles.sectionAccentDot} />
                  <Text style={styles.sectionTitle}>Search location</Text>
                </View>
                <LinearGradient
                  colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sectionRule}
                />
              </View>

              <View style={styles.searchBlock}>
                <LocationSearchField
                  label="Where do you want to browse?"
                  placeholder="e.g. Lagos, Abuja, London"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSelectSuggestion={onPickLocation}
                />
              </View>

              <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
                <View style={styles.sectionHeadRow}>
                  <View style={styles.sectionAccentDot} />
                  <Text style={styles.sectionTitle}>Quick presets</Text>
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
                <View style={styles.cardInnerPad}>
                  {PRESETS.map((p, i) => (
                    <Pressable
                      key={p.label}
                      onPress={() => {
                        setSearchQuery(p.label);
                        void save({ label: p.label, latitude: p.latitude, longitude: p.longitude });
                      }}
                      style={({ pressed }) => [
                        styles.presetRow,
                        i < PRESETS.length - 1 && styles.presetRowBorder,
                        pressed && styles.presetRowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${p.label} as travel location`}
                    >
                      <View style={styles.presetRowLeft}>
                        <Ionicons name="location-outline" size={22} color={colors.primary} />
                        <Text style={styles.presetLabel}>{p.label}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </LinearGradient>

              <Pressable
                onPress={() => void save(null)}
                style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Clear travel mode"
              >
                <Text style={styles.clearBtnTxt}>Clear travel mode</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  scroll: {
    paddingBottom: spacing.xl * 2,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  topNavSpacer: {
    width: 44,
    height: 44,
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
    marginTop: spacing.lg,
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
  cardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
  cardInnerPad: {
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
  paywallHero: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  paywallIconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  paywallHeroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.25,
    textAlign: 'center',
  },
  paywallHeroSub: {
    marginTop: spacing.xs,
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 7,
    opacity: 0.85,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  presetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 29, 38, 0.08)',
  },
  presetRowPressed: {
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  presetRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  presetLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  searchBlock: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    zIndex: 20,
  },
  ctaWrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  activeCardOuter: {
    marginBottom: spacing.lg,
  },
  activeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  activeCardTextCol: { flex: 1, minWidth: 0 },
  activeCardLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  activeCardPlace: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 22,
  },
  ctaOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 54,
    alignSelf: 'stretch',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#6C63FF',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 18,
        }
      : { elevation: 5 }),
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.97 }],
  },
  ctaGrad: {
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  clearBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});
