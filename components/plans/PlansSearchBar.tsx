/**
 * Debounced search field for the plans feed (title, description, category).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';

const DEBOUNCE_MS = 400;

type Props = {
  onDebouncedQueryChange: (query: string) => void;
  placeholder?: string;
  /** Glass-style field on gradient feeds (Discover list). */
  variant?: 'default' | 'premium';
};

export function PlansSearchBar({
  onDebouncedQueryChange,
  placeholder = 'Search plans, categories, or keywords',
  variant = 'default',
}: Props) {
  const [text, setText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onDebouncedQueryChange(text);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, onDebouncedQueryChange]);

  const ringWidth = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });
  const ringColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(15, 23, 42, 0.08)', colors.primary],
  });

  function onFocus() {
    Animated.spring(focusAnim, { toValue: 1, useNativeDriver: false, friction: 7 }).start();
  }

  function onBlur() {
    Animated.spring(focusAnim, { toValue: 0, useNativeDriver: false, friction: 7 }).start();
  }

  const outerStyle = variant === 'premium' ? styles.outerPremium : styles.outer;
  const innerStyle = variant === 'premium' ? styles.innerPremium : styles.inner;

  return (
    <View style={outerStyle}>
      <Animated.View style={[styles.ring, { borderWidth: ringWidth, borderColor: ringColor }]}>
        <View style={innerStyle}>
          <Ionicons name="search" size={20} color={colors.textMuted} style={styles.icon} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            onFocus={onFocus}
            onBlur={onBlur}
            accessibilityLabel="Search plans"
          />
          {text.length > 0 ? (
            <Pressable
              onPress={() => setText('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.clear}
            >
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  outerPremium: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  ring: {
    borderRadius: radius.button,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  innerPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    paddingVertical: 2,
  },
  clear: { marginLeft: 4 },
});
