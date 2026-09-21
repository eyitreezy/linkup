import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MM } from '@/constants/matchmakerTheme';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { MatchMakerPoolEmptyReason } from '@/lib/matchmaker/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Config = {
  iconName?: keyof typeof Ionicons.glyphMap;
  useMMIcon?: boolean;
  heading: string;
  sub: string;
  ctaLabel?: string;
  ctaHref?: string;
  tips?: { icon: keyof typeof Ionicons.glyphMap; text: string; tint: string }[];
};

const CONFIGS: Record<NonNullable<MatchMakerPoolEmptyReason>, Config> = {
  gender_not_set: {
    iconName: 'person-outline',
    heading: 'Complete your profile first',
    sub: 'Add your gender to your profile so we can find the right matches for you.',
    ctaLabel: 'Update profile',
    ctaHref: '/settings/edit-profile',
  },
  dealbreakers_strict: {
    iconName: 'options-outline',
    heading: 'Your filters are quite specific',
    sub: 'Your dealbreaker settings may be narrowing the pool. Try relaxing one or two to see more profiles.',
    ctaLabel: 'Review dealbreakers',
    ctaHref: '/matchmaker/settings',
  },
  location_narrow: {
    iconName: 'location-outline',
    heading: 'No one close by right now',
    sub: 'There are no verified MatchMaker members within your distance range yet. Try widening your range.',
    ctaLabel: 'Adjust distance',
    ctaHref: '/matchmaker/settings',
  },
  genuinely_empty: {
    useMMIcon: true,
    heading: 'Your pool is quiet right now',
    sub: 'Your match may still be on the way. The pool refreshes as new members join.',
    tips: [
      { icon: 'time-outline', text: 'New members join every day', tint: colors.primary },
      { icon: 'shield-checkmark-outline', text: 'Every profile is identity-verified', tint: '#059669' },
    ],
  },
};

type Props = { reason: MatchMakerPoolEmptyReason };

export function MatchMakerPoolEmptyState({ reason }: Props) {
  const cfg = CONFIGS[reason ?? 'genuinely_empty'];
  const iconColor =
    cfg.iconName === 'location-outline' ||
    cfg.iconName === 'options-outline' ||
    cfg.iconName === 'person-outline'
      ? colors.primary
      : MM.accent;

  return (
    <View style={s.wrap}>
      <LinearGradient
        colors={['rgba(155,27,75,0.28)', 'rgba(108,99,255,0.20)', 'rgba(155,27,75,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.ringOuter}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.97)', 'rgba(253,248,244,0.98)']}
          style={s.ringInner}
        >
          {cfg.useMMIcon ? (
            <MatchMakerTabIcon size={42} color={MM.accent} active />
          ) : (
            <Ionicons name={cfg.iconName!} size={42} color={iconColor} />
          )}
        </LinearGradient>
      </LinearGradient>

      <Text style={s.heading}>{cfg.heading}</Text>
      <Text style={s.sub}>{cfg.sub}</Text>

      {cfg.ctaLabel && cfg.ctaHref ? (
        <Pressable
          onPress={() => router.push(cfg.ctaHref! as Href)}
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[colors.primary, MM.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGradient}
          >
            <Text style={s.ctaLabel}>{cfg.ctaLabel}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      {cfg.tips && cfg.tips.length > 0 ? (
        <View style={s.tipsCard}>
          <Text style={s.tipsHeader}>While you wait</Text>
          {cfg.tips.map((tip) => (
            <View key={tip.text} style={s.tipRow}>
              <View style={[s.tipIcon, { backgroundColor: `${tip.tint}18` }]}>
                <Ionicons name={tip.icon} size={18} color={tip.tint} />
              </View>
              <Text style={s.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  ringOuter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    padding: 3,
    marginBottom: spacing.lg,
    shadowColor: MM.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
  },
  ringInner: {
    flex: 1,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  sub: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.lg,
    maxWidth: 300,
  },
  cta: { width: '100%', marginBottom: spacing.lg },
  ctaGradient: { borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' },
  ctaLabel: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
  tipsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.12)',
  },
  tipsHeader: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  tipIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, flex: 1 },
});
