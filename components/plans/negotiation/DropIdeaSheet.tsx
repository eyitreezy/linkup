/**
 * Bottom sheet shell for “Drop your idea” — pan on header, scrollable body, keyboard-safe.
 */
import { KeyboardAwareContainer } from '@/components/KeyboardAwareContainer';
import { colors, radius, spacing } from '@/constants/theme';
import type { DraggableSheetController } from '@/hooks/useDraggableSheet';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type DropIdeaSheetProps = {
  controller: DraggableSheetController;
  expandedHeight: number;
  children: React.ReactNode;
  keyboardVerticalOffset?: number;
  typingBackdropStyle?: Record<string, unknown>;
};

export function DropIdeaSheet({
  controller,
  expandedHeight,
  children,
  keyboardVerticalOffset = 0,
  typingBackdropStyle,
}: DropIdeaSheetProps) {
  const insets = useSafeAreaInsets();
  const {
    panGesture,
    sheetAnimatedStyle,
    sheetShadowStyle,
    translateY,
    maxTranslate,
    expand,
    collapse,
    snapToMid,
  } = controller;

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
          { height: expandedHeight, paddingBottom: insets.bottom },
          sheetAnimatedStyle,
          sheetShadowStyle,
        ] as unknown as StyleProp<ViewStyle>
      }
      pointerEvents="box-none"
    >
      <KeyboardAwareContainer
        style={styles.flex}
        keyboardVerticalOffset={keyboardVerticalOffset}
        backdropStyle={typingBackdropStyle}
      >
        <LinearGradient
          colors={['#FFFFFF', '#FFF9FB', '#F8F6FF']}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradient}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.expandedWash, expandedWash]}
          />
          <GestureDetector gesture={panGesture}>
            <View
              style={styles.dragHeader}
              accessibilityRole="adjustable"
              accessibilityLabel="Drop your idea sheet"
              accessibilityHint="Drag up or down to resize. Or use expand and collapse."
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'increment') expand();
                if (e.nativeEvent.actionName === 'decrement') collapse();
              }}
              accessibilityActions={[
                { name: 'increment', label: 'Expand sheet' },
                { name: 'decrement', label: 'Collapse sheet' },
              ]}
            >
              <View style={styles.sheetHandle} accessibilityLabel="Sheet handle" />
              <View style={styles.titleRow}>
                <Text style={styles.composerTitle} accessibilityRole="header">
                  Drop your idea
                </Text>
                <View style={styles.a11yRow}>
                  <Pressable
                    onPress={expand}
                    accessibilityRole="button"
                    accessibilityLabel="Expand sheet"
                    style={({ pressed }) => [styles.a11yBtn, pressed && styles.a11yBtnPressed]}
                    hitSlop={8}
                  >
                    <Text style={styles.a11yBtnTxt}>Expand</Text>
                  </Pressable>
                  <Pressable
                    onPress={snapToMid}
                    accessibilityRole="button"
                    accessibilityLabel="Mid height sheet"
                    style={({ pressed }) => [styles.a11yBtn, pressed && styles.a11yBtnPressed]}
                    hitSlop={8}
                  >
                    <Text style={styles.a11yBtnTxt}>Mid</Text>
                  </Pressable>
                  <Pressable
                    onPress={collapse}
                    accessibilityRole="button"
                    accessibilityLabel="Collapse sheet"
                    style={({ pressed }) => [styles.a11yBtn, pressed && styles.a11yBtnPressed]}
                    hitSlop={8}
                  >
                    <Text style={styles.a11yBtnTxt}>Collapse</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </GestureDetector>
          <View style={styles.body}>{children}</View>
        </LinearGradient>
      </KeyboardAwareContainer>
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
  flex: { flex: 1 },
  gradient: { flex: 1 },
  expandedWash: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  dragHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    ...Platform.select({
      android: { elevation: 0 },
    }),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 29, 38, 0.16)',
    marginBottom: spacing.sm,
  },
  titleRow: { gap: spacing.xs },
  composerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
  },
  a11yRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  a11yBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  a11yBtnPressed: { opacity: 0.88 },
  a11yBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.1,
  },
  body: { flex: 1, minHeight: 120 },
});
