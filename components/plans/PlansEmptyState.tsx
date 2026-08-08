/**
 * Discover feed empty — app-standard illustration, tips, and CTA.
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onCreatePress: () => void;
  travelCity?: string;
  onTurnOffTravel?: () => void;
};

const IDEAS = [
  { icon: 'restaurant-outline' as const, text: 'Dinner in Lekki tonight', tint: colors.primary },
  { icon: 'barbell-outline' as const, text: 'Gym buddy this weekend', tint: colors.secondary },
  { icon: 'cafe-outline' as const, text: 'Coffee and a walk near you', tint: '#059669' },
];

export function PlansEmptyState({ onCreatePress, travelCity, onTurnOffTravel }: Props) {
  if (travelCity) {
    return (
      <View style={styles.wrap}>
        <View style={styles.travelEmptyWrap}>
          <Ionicons name="airplane-outline" size={40} color={colors.textMuted} />
          <Text style={styles.title}>No plans in {travelCity} yet</Text>
          <Text style={styles.sub}>
            There are no active plans in this area right now. Check back later or browse your home city.
          </Text>
          {onTurnOffTravel ? (
            <Pressable
              onPress={onTurnOffTravel}
              style={({ pressed }) => [styles.turnOffCta, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Turn off travel mode"
            >
              <Text style={styles.turnOffCtaLabel}>Turn off travel mode</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(94, 82, 255, 0.35)', 'rgba(255, 74, 114, 0.28)', 'rgba(16, 185, 129, 0.18)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.artRingOuter}
      >
        <LinearGradient colors={['rgba(255,255,255,0.96)', 'rgba(248,244,255,0.98)']} style={styles.artRingInner}>
          <Ionicons name="compass-outline" size={42} color={colors.primary} />
        </LinearGradient>
      </LinearGradient>

      <Text style={styles.title}>
        Nothing nearby <Text style={styles.titleAccent}>yet</Text>
      </Text>
      <Text style={styles.sub}>
        When someone posts a meetup near you, it will show up here. Or start one yourself and get things moving.
      </Text>

      <View style={styles.tips}>
        <View style={styles.tipsHead}>
          <Ionicons name="sparkles" size={18} color={colors.secondary} />
          <Text style={styles.tipsLabel}>Ideas to try</Text>
        </View>
        {IDEAS.map((idea) => (
          <View key={idea.text} style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: `${idea.tint}18` }]}>
              <Ionicons name={idea.icon} size={18} color={idea.tint} />
            </View>
            <Text style={styles.tip}>{idea.text}</Text>
          </View>
        ))}
      </View>

      <LinearGradient
        colors={[colors.primary, '#8B7CFF', colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ctaShell}
      >
        <Button
          title="Suggest a meetup"
          onPress={onCreatePress}
          pill
          variant="primary"
          style={styles.ctaInner}
          textStyle={styles.ctaTxt}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    width: '100%',
  },
  artRingOuter: {
    width: 108,
    height: 108,
    borderRadius: 54,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  artRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  titleAccent: { color: colors.secondary },
  sub: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
    maxWidth: 340,
  },
  tips: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.16)',
    gap: spacing.sm,
    maxWidth: 360,
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  tipsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tipsLabel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 2,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 22,
    paddingTop: 6,
  },
  ctaShell: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    borderRadius: radius.button,
    padding: 2,
    maxWidth: 360,
    width: '100%',
  },
  ctaInner: { backgroundColor: '#fff', width: '100%', margin: 0 },
  ctaTxt: {
    color: colors.primary,
    fontWeight: '900',
    fontFamily: fonts.bold,
  },
  travelEmptyWrap: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  turnOffCta: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
    backgroundColor: 'rgba(94, 82, 255, 0.06)',
  },
  turnOffCtaLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
