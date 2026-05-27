/**
 * iMessage-style typing dots.
 */
import { colors, spacing } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  peerName?: string;
};

export function ChatTypingIndicator({ visible, peerName }: Props) {
  const a1 = useRef(new Animated.Value(0.35)).current;
  const a2 = useRef(new Animated.Value(0.35)).current;
  const a3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!visible) return;
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.35,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
    const l1 = mk(a1, 0);
    const l2 = mk(a2, 120);
    const l3 = mk(a3, 240);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [visible, a1, a2, a3]);

  if (!visible) return null;

  return (
    <View style={styles.row} accessibilityLabel="Typing">
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, { opacity: a1 }]} />
        <Animated.View style={[styles.dot, { opacity: a2 }]} />
        <Animated.View style={[styles.dot, { opacity: a3 }]} />
      </View>
      <Text style={styles.txt} numberOfLines={1}>
        {peerName ? `${peerName} is typing…` : 'Typing…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.65,
  },
  txt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
