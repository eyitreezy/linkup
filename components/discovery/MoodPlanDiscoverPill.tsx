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

function LiveMoodBorder({
  active,
  children,
  borderRadius,
}: {
  active: boolean;
  children: ReactNode;
  borderRadius: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (active) {
      t.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(0, { duration: 1800, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(t);
      t.value = withTiming(0, { duration: 280 });
    }
  }, [active, t]);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(t.value, [0, 0.5, 1], [
      'rgba(108,99,255,0.92)',
      'rgba(186,104,255,0.88)',
      'rgba(255,101,132,0.94)',
    ]),
    borderWidth: 2,
  }));

  if (!active) {
    return (
      <View
        style={[
          styles.liveRing,
          {
            borderRadius,
            borderWidth: 2,
            borderColor: 'rgba(167,139,250,0.55)',
          },
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={[styles.liveRing, { borderRadius }, ringStyle]}>{children}</Animated.View>
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
              onPress={open}
              onHoverIn={() => Platform.OS === 'web' && setHovered(true)}
              onHoverOut={() => Platform.OS === 'web' && setHovered(false)}
              style={({ pressed }) => [styles.mainPress, pressed && styles.mainPressPressed]}
              accessibilityRole="button"
              accessibilityHint={
                expanded ? 'Opens this mood plan' : 'Opens plan. On web, hover to see more detail.'
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
                  {row.mood_expires_at ? (
                    <View style={styles.pillCount}>
                      <Ionicons name="hourglass-outline" size={15} color={colors.secondary} />
                      <MoodPlanCountdown expiresAtIso={row.mood_expires_at} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.cardBody}>
                  <View style={styles.topMetaRow}>
                    <LinearGradient
                      colors={['rgba(108,99,255,0.22)', 'rgba(255,101,132,0.2)', 'rgba(16,185,129,0.14)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.pulseCapsule}
                    >
                      <View style={styles.pulseRow}>
                        <Ionicons name="sparkles" size={15} color={colors.primary} />
                        <Text style={styles.pulseLabel}>Mood moment</Text>
                      </View>
                    </LinearGradient>
                    {meta.moodTypeLabel ? (
                      <LinearGradient
                        colors={['rgba(255,255,255,0.95)', 'rgba(225,220,255,0.88)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.moodChip}
                      >
                        <Text style={styles.moodChipTxt} numberOfLines={1}>
                          {meta.moodTypeLabel}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.topMetaSpacer} />
                    )}
                  </View>
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
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    minHeight: 58,
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
  pillCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    paddingLeft: 8,
    marginLeft: 0,
    minHeight: 40,
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
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    width: '100%',
  },
  topMetaSpacer: {
    flex: 1,
    minWidth: 0,
    minHeight: 1,
  },
  pulseCapsule: {
    flexShrink: 0,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  pulseLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.85,
    opacity: 0.88,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 23,
    letterSpacing: -0.35,
    marginBottom: 10,
  },
  moodChip: {
    flexShrink: 1,
    maxWidth: '52%',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.28)',
  },
  moodChipTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'lowercase',
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
