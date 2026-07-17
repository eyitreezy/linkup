import { Button } from '@/components/Button';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { goToDiscoveryFeed } from '@/lib/navigation/goToDiscoveryFeed';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

export type PlanAgreementEmptyReason =
  | 'no_offer'
  | 'not_found'
  | 'cancelled'
  | 'no_access'
  | 'unavailable';

type Props = {
  planId: string;
  reason: PlanAgreementEmptyReason;
  planTitle?: string | null;
};

export function resolveAgreementEmptyReason(
  error: unknown,
  hasPlan: boolean,
  hasOffer: boolean
): PlanAgreementEmptyReason {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();

  if (!hasPlan || message.includes('plan not found')) return 'not_found';
  if (message.includes('no access')) return 'no_access';
  if (!hasOffer || message.includes('no accepted offer')) return 'no_offer';
  if (message.includes('not available')) return 'unavailable';

  return 'unavailable';
}

type Tip = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tint: string;
};

type ReasonConfig = {
  emoji: string;
  title: string;
  titleAccent: string;
  description: string;
  tips?: Tip[];
  tipsLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  headerTitle: string;
};

function configForReason(planId: string, reason: PlanAgreementEmptyReason): ReasonConfig {
  const backToPlan = () => router.replace(`/plan/${planId}` as Href);
  const openNegotiate = () => router.push(`/plan/${planId}/negotiate` as Href);

  switch (reason) {
    case 'no_offer':
      return {
        emoji: '🤝',
        headerTitle: 'Confirm plan',
        title: 'No agreement yet',
        titleAccent: 'agreement',
        description:
          'An accepted offer is required before you can confirm this plan. Finish negotiation or wait for the host to accept your slot.',
        tips: [
          {
            icon: 'document-text-outline',
            text: 'Both people review the same summary before a plan goes active',
            tint: colors.primary,
          },
          {
            icon: 'chatbubble-ellipses-outline',
            text: 'Message from meetup details if timing or price still needs alignment',
            tint: colors.secondary,
          },
        ],
        tipsLabel: 'What happens next',
        primaryLabel: 'Back to meetup details',
        onPrimary: backToPlan,
        secondaryLabel: 'Open negotiation',
        onSecondary: openNegotiate,
      };
    case 'not_found':
      return {
        emoji: '🔍',
        headerTitle: 'Confirm plan',
        title: 'Plan not found',
        titleAccent: 'found',
        description: 'This meetup may have been removed or the link is no longer valid.',
        primaryLabel: 'Browse Discover',
        onPrimary: () => goToDiscoveryFeed(),
        secondaryLabel: 'My offers',
        onSecondary: () => router.push('/(tabs)/offers' as Href),
      };
    case 'cancelled':
      return {
        emoji: '📋',
        headerTitle: 'Plan cancelled',
        title: 'Agreement ended',
        titleAccent: 'ended',
        description:
          'This plan was cancelled and the agreement is no longer active. Any escrow refunds follow LinkUp cancellation policy.',
        tips: [
          {
            icon: 'shield-checkmark-outline',
            text: 'Cancellation outcomes are enforced on LinkUp servers',
            tint: colors.primary,
          },
          {
            icon: 'arrow-back-outline',
            text: 'Open meetup details to see the latest plan status',
            tint: colors.secondary,
          },
        ],
        tipsLabel: 'Good to know',
        primaryLabel: 'Back to meetup details',
        onPrimary: backToPlan,
        secondaryLabel: 'Discover plans',
        onSecondary: () => goToDiscoveryFeed(),
      };
    case 'no_access':
      return {
        emoji: '🔒',
        headerTitle: 'Agreement restricted',
        title: 'No access to this agreement',
        titleAccent: 'access',
        description: 'Only the host and accepted guest for this plan can review and confirm here.',
        tips: [
          {
            icon: 'lock-closed-outline',
            text: 'Group plans use a separate agreement per accepted guest slot',
            tint: colors.primary,
          },
          {
            icon: 'chatbubble-ellipses-outline',
            text: 'Ask the host to share the correct plan link if you were invited',
            tint: colors.secondary,
          },
        ],
        tipsLabel: 'Why you might see this',
        primaryLabel: 'Back to meetup details',
        onPrimary: backToPlan,
        secondaryLabel: 'Browse Discover',
        onSecondary: () => goToDiscoveryFeed(),
      };
    default:
      return {
        emoji: '⚠️',
        headerTitle: 'Confirm plan',
        title: 'Agreement unavailable',
        titleAccent: 'unavailable',
        description:
          'We could not load this confirmation screen right now. Check your connection and try again from meetup details.',
        primaryLabel: 'Back to meetup details',
        onPrimary: backToPlan,
        secondaryLabel: 'Try negotiation',
        onSecondary: openNegotiate,
      };
  }
}

function renderTitle(title: string, accent: string) {
  const idx = title.indexOf(accent);
  if (idx < 0) return <Text style={styles.title}>{title}</Text>;
  const before = title.slice(0, idx);
  const after = title.slice(idx + accent.length);
  return (
    <Text style={styles.title}>
      {before}
      <Text style={styles.titleAccent}>{accent}</Text>
      {after}
    </Text>
  );
}

export function PlanAgreementEmptyState({ planId, reason, planTitle }: Props) {
  const config = configForReason(planId, reason);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerBlock}>
        <Text style={styles.kicker}>Agreement</Text>
        <Text style={styles.headerTitle}>{config.headerTitle}</Text>
        {planTitle?.trim() ? <Text style={styles.headerSubtitle}>{planTitle.trim()}</Text> : null}
      </View>

      <View style={styles.wrap}>
        <LinearGradient
          colors={['rgba(94, 82, 255, 0.35)', 'rgba(255, 74, 114, 0.28)', 'rgba(16, 185, 129, 0.18)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.artRingOuter}
        >
          <LinearGradient colors={['rgba(255,255,255,0.96)', 'rgba(248,244,255,0.98)']} style={styles.artRingInner}>
            <Text style={styles.emoji}>{config.emoji}</Text>
          </LinearGradient>
        </LinearGradient>

        {renderTitle(config.title, config.titleAccent)}
        <Text style={styles.sub}>{config.description}</Text>

        {config.tips?.length ? (
          <View style={styles.tips}>
            {config.tipsLabel ? (
              <View style={styles.tipsHead}>
                <Ionicons name="sparkles" size={18} color={colors.secondary} />
                <Text style={styles.tipsLabel}>{config.tipsLabel}</Text>
              </View>
            ) : null}
            {config.tips.map((tip) => (
              <View key={tip.text} style={styles.tipRow}>
                <View style={[styles.tipIcon, { backgroundColor: `${tip.tint}18` }]}>
                  <Ionicons name={tip.icon} size={18} color={tip.tint} />
                </View>
                <Text style={styles.tip}>{tip.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <LinearGradient
          colors={[colors.primary, '#8B7CFF', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaShell}
        >
          <Button
            title={config.primaryLabel}
            onPress={config.onPrimary}
            pill
            variant="primary"
            style={styles.ctaInner}
            textStyle={styles.ctaTxt}
          />
        </LinearGradient>

        {config.secondaryLabel && config.onSecondary ? (
          <Button
            title={config.secondaryLabel}
            onPress={config.onSecondary}
            pill
            variant="secondary"
            style={styles.ctaSecondary}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  headerBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
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
  emoji: {
    fontSize: 42,
    lineHeight: 48,
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
  ctaSecondary: {
    alignSelf: 'stretch',
    maxWidth: 360,
    width: '100%',
    marginTop: spacing.sm,
    borderRadius: radius.button,
  },
});
