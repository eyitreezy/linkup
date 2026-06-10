/**
 * Tinder-style pass / like / info row with spring press feedback (Reanimated).
 */
import { colors, spacing } from '@/constants/theme';
import { SWIPE_ACTION_ROW_PAD_Y } from '@/lib/discovery/swipeLayout';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type Props = {
  onPass: () => void;
  onLike: () => void;
  onInfo: () => void;
  disabled?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function useBouncePress() {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const onPressIn = () => {
    s.value = withSpring(0.88, { damping: 14, stiffness: 400 });
  };
  const onPressOut = () => {
    s.value = withSpring(1, { damping: 12, stiffness: 320 });
  };
  return { style, onPressIn, onPressOut };
}

function SwipeActionButtonsInner({ onPass, onLike, onInfo, disabled }: Props) {
  const passAnim = useBouncePress();
  const likeAnim = useBouncePress();
  const infoAnim = useBouncePress();

  return (
    <View style={styles.row} pointerEvents={disabled ? 'none' : 'auto'}>
      <AnimatedPressable
        onPress={onPass}
        disabled={disabled}
        onPressIn={passAnim.onPressIn}
        onPressOut={passAnim.onPressOut}
        style={[styles.passOuter, passAnim.style, disabled && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel="Pass"
      >
        <View style={styles.passInner}>
          <Ionicons name="close" size={30} color="#fff" />
        </View>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={onInfo}
        disabled={disabled}
        onPressIn={infoAnim.onPressIn}
        onPressOut={infoAnim.onPressOut}
        style={[styles.infoBtn, infoAnim.style, disabled && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel="Open details"
      >
        <Ionicons name="information-circle-outline" size={26} color={colors.primary} />
      </AnimatedPressable>

      <AnimatedPressable
        onPress={onLike}
        disabled={disabled}
        onPressIn={likeAnim.onPressIn}
        onPressOut={likeAnim.onPressOut}
        style={[styles.likeOuter, likeAnim.style, disabled && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel="Into it — open meetup"
      >
        <View style={styles.likeClip}>
          <LinearGradient
            colors={[colors.secondary, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.likeGradient}
          >
            <Ionicons name="heart" size={30} color="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.flashBadge} pointerEvents="none">
          <Ionicons name="flash" size={13} color={colors.primary} />
        </View>
      </AnimatedPressable>
    </View>
  );
}

export const SwipeActionButtons = memo(SwipeActionButtonsInner);

const PASS = 58;
const LIKE = 68;
const INFO = 48;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: SWIPE_ACTION_ROW_PAD_Y,
    paddingHorizontal: spacing.md,
  },
  disabled: { opacity: 0.4 },
  passOuter: {
    width: PASS,
    height: PASS,
    borderRadius: PASS / 2,
    backgroundColor: colors.passAction,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.passAction,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  passInner: { alignItems: 'center', justifyContent: 'center' },
  infoBtn: {
    width: INFO,
    height: INFO,
    borderRadius: INFO / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.25)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  likeOuter: {
    width: LIKE,
    height: LIKE,
    borderRadius: LIKE / 2,
    position: 'relative',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  likeClip: {
    width: LIKE,
    height: LIKE,
    borderRadius: LIKE / 2,
    overflow: 'hidden',
  },
  likeGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
  },
});
