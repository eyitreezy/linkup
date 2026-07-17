/**
 * Bottom sheet shell for “Drop your idea” — pan on header, scrollable body, keyboard-safe.
 */
import { colors, spacing, fonts } from '@/constants/theme';
import type { DraggableSheetController } from '@/hooks/useDraggableSheet';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type DropIdeaSheetProps = {
  controller: DraggableSheetController;
  children: React.ReactNode;
  keyboardVerticalOffset?: number;
  typingBackdropStyle?: Record<string, unknown>;
  /** Lifts the whole sheet above the IME (iOS + Android). */
  composerLiftStyle?: StyleProp<ViewStyle>;
};

export function DropIdeaSheet({
  controller,
  children,
  keyboardVerticalOffset = 0,
  typingBackdropStyle,
  composerLiftStyle,
}: DropIdeaSheetProps) {
  const insets = useSafeAreaInsets();
  const { panGesture, sheetAnimatedStyle, sheetShadowStyle, translateY, maxTranslate } = controller;

  const expandedWash = useAnimatedStyle(() => {
    const maxT = maxTranslate > 0.5 ? maxTranslate : 1;
    const lift = 1 - translateY.value / maxT;
    return {
      opacity: interpolate(lift, [0, 1], [0, 0.12], 'clamp'),
    };
  }, [maxTranslate]);

  return (
    <Animated.View
      style={
        [
          styles.sheet,
          { paddingBottom: insets.bottom },
          sheetAnimatedStyle,
          sheetShadowStyle,
          composerLiftStyle,
        ] as unknown as StyleProp<ViewStyle>
      }
      pointerEvents="box-none"
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <LinearGradient
          colors={['#FFFFFF', '#FFF9FB', '#F8F6FF']}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradient}
        >
          <Animated.View pointerEvents="none" style={[styles.expandedWash, expandedWash]} />
          {typingBackdropStyle ? (
            <Animated.View pointerEvents="none" style={[styles.dimOverlay, typingBackdropStyle]} />
          ) : null}
          <GestureDetector gesture={panGesture}>
            <View
              style={styles.dragHeader}
              accessibilityRole="header"
              accessibilityLabel="Drop your idea sheet"
            >
              <Text style={styles.sheetKicker}>Your suggestion</Text>
              <Text style={styles.composerTitle} accessibilityRole="header">
                Drop your idea
              </Text>
            </View>
          </GestureDetector>
          <View style={styles.body}>{children}</View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  flex: { flex: 1, minHeight: 0 },
  gradient: { flex: 1, minHeight: 0 },
  expandedWash: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'rgba(94, 82, 255, 0.06)',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    zIndex: 4,
  },
  dragHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    ...Platform.select({
      android: { elevation: 0 },
    }),
  },
  sheetKicker: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  composerTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: spacing.sm,
  },
  body: { flex: 1, minHeight: 0, overflow: 'hidden' },
});
