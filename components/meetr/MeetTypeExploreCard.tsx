/**
 * Tinder Explore–style portrait tile — matches linkup-web MeetTypeExploreCard.
 */
import { isCatalogMeetType, isMeetTypePendingForUser } from '@/lib/plans/meetTypes';
import { resolveMeetTypeCoverSource } from '@/lib/plans/resolveMeetTypeCoverSource';
import { meetTypeGradient, meetTypeIconName } from '@/lib/plans/meetTypeVisuals';
import { isUserMeetType } from '@/lib/plans/userMeetTypeCrud';
import type { DbMeetType } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { fonts, spacing } from '@/constants/theme';

type Props = {
  type: DbMeetType;
  userId: string | undefined;
  onPress: (type: DbMeetType) => void;
};

/** Portrait tile — width : height = 3 : 4 */
const TILE_ASPECT = 3 / 4;
const REVEAL_MS = 220;

const TITLE_FONT_SIZE = 15;
const TITLE_LINE_HEIGHT = 20;
const TITLE_MAX_LINES = 2;
const TITLE_PADDING_TOP = 28;
const TITLE_PADDING_BOTTOM = 14;
/** Room for gradient fade + two full title lines (see compact scrim sizing). */
const TITLE_SCRIM_MIN_HEIGHT =
  TITLE_PADDING_TOP + TITLE_PADDING_BOTTOM + TITLE_LINE_HEIGHT * TITLE_MAX_LINES;
/** Compact scrim height as % of tile — must fit TITLE_SCRIM_MIN_HEIGHT on narrow 2-col phones. */
const COMPACT_SCRIM_HEIGHT_PCT = 48;

function TileTitleOverlay({
  title,
  description,
  revealed,
}: {
  title: string;
  description?: string | null;
  revealed: boolean;
}) {
  const progress = useSharedValue(0);
  const trimmedDescription = description?.trim() ?? '';
  const hasDescription = trimmedDescription.length > 0;

  useEffect(() => {
    progress.value = withTiming(revealed && hasDescription ? 1 : 0, {
      duration: REVEAL_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [revealed, hasDescription, progress]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.22]),
  }));

  const scrimStyle = useAnimatedStyle(() => {
    if (!hasDescription) {
      return { height: TITLE_SCRIM_MIN_HEIGHT };
    }
    return {
      height: `${interpolate(progress.value, [0, 1], [COMPACT_SCRIM_HEIGHT_PCT, 100])}%`,
    };
  });

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [1, 0], 'clamp'),
  }));

  const descriptionLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.2, 1], [0, 1], 'clamp'),
  }));

  const showDescription = revealed && hasDescription;

  return (
    <>
      {hasDescription ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, styles.peekDim, dimStyle]}
        />
      ) : null}
      <Animated.View style={[styles.titleScrimWrap, scrimStyle]} pointerEvents="none">
        <LinearGradient
          colors={
            showDescription
              ? ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.92)']
              : ['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.8)']
          }
          locations={showDescription ? [0, 0.35, 1] : [0, 0.45, 1]}
          style={showDescription ? styles.titleScrimGradientExpanded : styles.titleScrimGradientCompact}
        >
          {hasDescription ? (
            <Animated.View
              pointerEvents={showDescription ? 'auto' : 'none'}
              style={[styles.descriptionLayer, descriptionLayerStyle]}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
                contentContainerStyle={styles.descriptionScrollContent}
              >
                <Text style={styles.descriptionTxt}>{trimmedDescription}</Text>
              </ScrollView>
            </Animated.View>
          ) : null}
          {!showDescription ? (
            <Animated.Text
              style={[styles.titleTxt, titleStyle]}
              numberOfLines={TITLE_MAX_LINES}
            >
              {title}
            </Animated.Text>
          ) : null}
        </LinearGradient>
      </Animated.View>
    </>
  );
}

function OwnedBadge() {
  return (
    <View style={styles.ownedBadge} pointerEvents="none">
      <Text style={styles.ownedBadgeTxt}>Yours</Text>
    </View>
  );
}

function PendingBadge() {
  return (
    <View style={styles.pendingBadge} pointerEvents="none">
      <Text style={styles.pendingBadgeTxt}>Pending</Text>
    </View>
  );
}

function ExploreTileShell({
  children,
  onPress,
  label,
  title,
  description,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  title: string;
  description?: string | null;
}) {
  const [revealed, setRevealed] = useState(false);

  const showPeek = useCallback(() => setRevealed(true), []);
  const hidePeek = useCallback(() => setRevealed(false), []);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={showPeek}
      onPressOut={hidePeek}
      onHoverIn={showPeek}
      onHoverOut={hidePeek}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        description?.trim() ? 'Hover or press to read the full description' : undefined
      }
    >
      {children}
      <TileTitleOverlay title={title} description={description} revealed={revealed} />
    </Pressable>
  );
}

function CatalogMeetTypeCard({
  type,
  onPress,
}: {
  type: DbMeetType;
  onPress: (type: DbMeetType) => void;
}) {
  const coverSource = resolveMeetTypeCoverSource(type);

  return (
    <ExploreTileShell
      onPress={() => onPress(type)}
      label={`Browse ${type.name} meetups`}
      title={type.name}
      description={type.description}
    >
      <Image source={coverSource} style={styles.coverImage} contentFit="cover" transition={200} />
    </ExploreTileShell>
  );
}

function CustomMeetTypeCard({
  type,
  userId,
  onPress,
}: {
  type: DbMeetType;
  userId: string | undefined;
  onPress: (type: DbMeetType) => void;
}) {
  const owned = !!userId && isUserMeetType(type, userId);
  const pending = isMeetTypePendingForUser(type, userId);
  const gradient = meetTypeGradient(type);
  const accent = gradient[0];

  return (
    <ExploreTileShell
      onPress={() => onPress(type)}
      label={pending ? `${type.name} pending approval` : `Browse ${type.name} meetups`}
      title={type.name}
      description={type.description}
    >
      <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        <View style={[styles.radialHighlight, pending && styles.tilePendingDim]} pointerEvents="none" />
        <View style={styles.iconCenter} pointerEvents="none">
          <View style={styles.iconRing}>
            <Ionicons name={meetTypeIconName(type)} size={36} color={accent} />
          </View>
        </View>
        {pending ? <PendingBadge /> : owned ? <OwnedBadge /> : null}
      </LinearGradient>
    </ExploreTileShell>
  );
}

export function MeetTypeExploreCard({ type, userId, onPress }: Props) {
  if (isCatalogMeetType(type)) {
    return <CatalogMeetTypeCard type={type} onPress={onPress} />;
  }
  return <CustomMeetTypeCard type={type} userId={userId} onPress={onPress} />;
}

/** Loading placeholder matching explore tile layout. */
export function MeetTypeExploreCardSkeleton() {
  return (
    <View style={[styles.tile, styles.skeletonTile]}>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.08)']}
        style={styles.skeletonScrim}
        pointerEvents="none"
      />
      <View style={styles.skeletonBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '100%',
    aspectRatio: TILE_ASPECT,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#E8E8ED',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: { elevation: 4 },
    }),
  },
  tilePressed: {
    opacity: 0.96,
    transform: [{ scale: 0.98 }],
  },
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  peekDim: {
    backgroundColor: '#000',
    zIndex: 1,
  },
  titleScrimWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  titleScrimGradientCompact: {
    flex: 1,
    minHeight: TITLE_SCRIM_MIN_HEIGHT,
    paddingHorizontal: 14,
    paddingTop: TITLE_PADDING_TOP,
    paddingBottom: TITLE_PADDING_BOTTOM,
    justifyContent: 'flex-end',
  },
  titleScrimGradientExpanded: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  descriptionLayer: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  descriptionScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  descriptionTxt: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleTxt: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: '#fff',
    letterSpacing: -0.2,
    lineHeight: TITLE_LINE_HEIGHT,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
    }),
  },
  radialHighlight: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: '72%',
    aspectRatio: 1,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  iconCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  ownedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  ownedBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pendingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(245,158,11,0.88)',
  },
  pendingBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tilePendingDim: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  skeletonTile: {
    backgroundColor: 'rgba(200,200,210,0.8)',
  },
  skeletonScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '34%',
  },
  skeletonBar: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    width: '66%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
