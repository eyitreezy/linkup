/**
 * Mood discover surface: compact pill (title, host, countdown) → expands to full card on web hover
 * or via chevron on native. Live plans get an animated gradient border while the window is open.
 */
import { MoodPlanCountdown } from '@/components/plans/MoodPlanCountdown';
import type { PlanFeedRow } from '@/components/plans/planFeedTypes';
import { colors, radius, spacing } from '@/constants/theme';
import { moodDiscoverMeta } from '@/lib/plans/moodDiscoverUi';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

function useMoodWindowLive(expiresAtIso: string | null | undefined): boolean {
  const [live, setLive] = useState(() =>
    expiresAtIso ? new Date(expiresAtIso).getTime() > Date.now() : false
  );
  useEffect(() => {
    if (!expiresAtIso) {
      setLive(false);
      return;
    }
    const tick = () => setLive(new Date(expiresAtIso).getTime() > Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);
  return live;
}

/** Instagram Live–style pulsing gradient ring + outer sparkle halo. */
function LiveMoodBorder({
  active,
  children,
  borderRadius,
}: {
  active: boolean;
  children: ReactNode;
  borderRadius: number;
}) {
  const pulse = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.bezier(0.45, 0, 0.2, 1) }),
          withTiming(0, { duration: 1400, easing: Easing.bezier(0.45, 0, 0.2, 1) })
        ),
        -1,
        false
      );
      halo.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulse);
      cancelAnimation(halo);
      pulse.value = withTiming(0, { duration: 280 });
      halo.value = withTiming(0, { duration: 280 });
    }
  }, [active, pulse, halo]);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(pulse.value, [0, 0.33, 0.66, 1], [
      '#F77737',
      '#FD1D1D',
      '#E1306C',
      '#C13584',
    ]),
    borderWidth: 2.5,
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - halo.value) * 0.55,
    transform: [{ scale: 1 + halo.value * 0.14 }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.03 }],
  }));

  if (!active) {
    return (
      <View
        style={[
          styles.liveRing,
          {
            borderRadius,
            borderWidth: 1.5,
            borderColor: 'rgba(167,139,250,0.4)',
          },
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={styles.liveRingHost}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.liveHalo,
          { borderRadius: borderRadius + 8 },
          haloStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.liveSparkle,
          { borderRadius: borderRadius + 4 },
          sparkleStyle,
        ]}
      />
      <Animated.View style={[styles.liveRing, { borderRadius }, ringStyle]}>{children}</Animated.View>
    </View>
  );
}

type Props = {
  row: PlanFeedRow;
  cardW: number;
  index: number;
  onOpenPlan: (row: PlanFeedRow) => void;
};

export const MoodPlanDiscoverPill = memo(function MoodPlanDiscoverPill({
  row,
  cardW,
  index,
  onOpenPlan,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const meta = useMemo(() => moodDiscoverMeta(row), [row]);
  const name = row.creatorProfile?.display_name?.trim() || 'Host';
  const avatar = row.creatorProfile?.avatar_url;
  const isLive = useMoodWindowLive(row.mood_expires_at);

  const [hovered, setHovered] = useState(false);
  const [chevronOpen, setChevronOpen] = useState(false);

  useEffect(() => {
    setChevronOpen(false);
    setHovered(false);
  }, [row.id]);

  const expanded = (Platform.OS === 'web' && hovered) || chevronOpen;

  const pillWCollapsed = useMemo(() => {
    const gutter = spacing.md * 2 + spacing.sm + 24;
    return Math.min(Math.max(cardW, 300), Math.max(260, winW - gutter));
  }, [cardW, winW]);

  const pillWExpanded = useMemo(
    () => Math.min(Math.max(cardW, 304), Math.max(280, winW - spacing.md * 2 - 20)),
    [cardW, winW]
  );

  const open = () => onOpenPlan(row);

  function onCardPress() {
    if (!expanded) {
      setChevronOpen(true);
      return;
    }
    open();
  }

  return (
    <MotiView
      from={{ opacity: 0.88, translateY: 5 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 340, delay: index * 36 }}
    >
      <LiveMoodBorder active={isLive} borderRadius={expanded ? radius.xl : radius.button}>
        <MotiView
          animate={{
            minHeight: expanded ? 0 : 58,
            width: expanded ? pillWExpanded : pillWCollapsed,
            borderRadius: expanded ? radius.xl - 2 : radius.button,
          }}
          transition={{ type: 'spring', damping: 18, stiffness: 300, mass: 0.82 }}
          style={styles.surface}
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.99)',
              'rgba(241,236,255,0.94)',
              'rgba(255,245,250,0.9)',
              'rgba(232,252,244,0.55)',
            ]}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(108,99,255,0.07)', 'rgba(255,101,132,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.85 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.rowWrap}>
            <Pressable
              onPress={onCardPress}
              onHoverIn={() => Platform.OS === 'web' && setHovered(true)}
              onHoverOut={() => Platform.OS === 'web' && setHovered(false)}
              style={({ pressed }) => [styles.mainPress, pressed && styles.mainPressPressed]}
              accessibilityRole="button"
              accessibilityHint={
                expanded ? 'Opens this mood plan' : 'Expands mood details. Tap again to open the plan.'
              }
            >
              {!expanded ? (
                <View style={styles.pillRow}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.pillAvatar} contentFit="cover" />
                  ) : (
                    <View style={styles.pillAvatarPh}>
                      <Ionicons name="person" size={15} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.pillCenter}>
                    <Text style={styles.pillTitle} numberOfLines={2}>
                      {row.title}
                    </Text>
                    <Text style={styles.pillHost} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.cardBody}>
                  <Text style={styles.title} numberOfLines={3}>
                    {row.title}
                  </Text>
                  <View style={styles.hostRow}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={styles.avatarPh}>
                        <Ionicons name="person" size={14} color={colors.primary} />
                      </View>
                    )}
                    <Text style={styles.hostName} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                  {meta.urgencyLabel ? (
                    <View style={styles.metaFooter}>
                      <View style={styles.urgentPill}>
                        <Text style={styles.urgentPillTxt}>{meta.urgencyLabel}</Text>
                      </View>
                      {row.mood_expires_at ? (
                        <View style={styles.countdownRow}>
                          <Ionicons name="hourglass-outline" size={14} color={colors.secondary} />
                          <MoodPlanCountdown expiresAtIso={row.mood_expires_at} />
                        </View>
                      ) : null}
                    </View>
                  ) : row.mood_expires_at ? (
                    <View style={styles.countdownStandalone}>
                      <View style={styles.countdownRow}>
                        <Ionicons name="hourglass-outline" size={14} color={colors.secondary} />
                        <MoodPlanCountdown expiresAtIso={row.mood_expires_at} />
                      </View>
                    </View>
                  ) : null}
                </View>
              )}
            </Pressable>

            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={() => setChevronOpen((v) => !v)}
                style={({ pressed }) => [styles.chevronBtn, pressed && { opacity: 0.9 }]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Collapse mood card' : 'Expand mood details'}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.35)', 'rgba(210,200,255,0.82)', 'rgba(255,225,236,0.78)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <MotiView
                  animate={{ rotate: expanded ? '180deg' : '0deg' }}
                  transition={{ type: 'timing', duration: 240 }}
                  style={styles.chevronSpin}
                >
                  <Ionicons name="chevron-down" size={22} color={colors.primary} />
                </MotiView>
              </Pressable>
            ) : null}
          </View>
        </MotiView>
      </LiveMoodBorder>
    </MotiView>
  );
});

const styles = StyleSheet.create({
  liveRingHost: {
    position: 'relative',
    overflow: 'visible',
  },
  liveHalo: {
    ...StyleSheet.absoluteFillObject,
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderWidth: 3,
    borderColor: 'rgba(255,48,72,0.35)',
    backgroundColor: 'rgba(255,101,132,0.08)',
  },
  liveSparkle: {
    ...StyleSheet.absoluteFillObject,
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    borderColor: 'rgba(253,29,29,0.28)',
    backgroundColor: 'transparent',
  },
  liveRing: {
    overflow: 'hidden',
  },
  surface: {
    overflow: 'hidden',
    position: 'relative',
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    position: 'relative',
    zIndex: 1,
  },
  mainPress: {
    flex: 1,
    minWidth: 0,
  },
  mainPressPressed: {
    opacity: 0.94,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  pillAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8F5FF',
    borderWidth: 2,
    borderColor: 'rgba(108,99,255,0.35)',
  },
  pillAvatarPh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(108,99,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,101,132,0.28)',
  },
  pillCenter: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingRight: 4,
  },
  pillTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.35,
    lineHeight: 20,
  },
  pillHost: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: -0.12,
  },
  chevronSpin: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  chevronBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(108,99,255,0.22)',
    minWidth: 48,
    overflow: 'hidden',
    position: 'relative',
  },
  cardBody: {
    paddingTop: spacing.md,
    paddingLeft: spacing.md,
    paddingBottom: spacing.md,
    paddingRight: Platform.OS !== 'web' ? spacing.md : spacing.md,
    gap: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 23,
    letterSpacing: -0.35,
    marginBottom: 10,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
    minHeight: 32,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  avatarPh: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(108,99,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostName: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textMuted },
  metaFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 0,
  },
  countdownStandalone: {
    marginTop: 12,
    marginBottom: 0,
  },
  urgentPill: {
    backgroundColor: 'rgba(255,101,132,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(255,101,132,0.35)',
  },
  urgentPillTxt: { fontSize: 11, fontWeight: '900', color: colors.secondary },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,101,132,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,101,132,0.2)',
  },
});
