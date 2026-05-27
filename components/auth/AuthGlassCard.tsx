/**
 * Glassmorphism auth form container — floats above hero background.
 */
import { AUTH_CARD_MARGIN_H, AUTH_CARD_PADDING_H } from '@/components/auth/authLayout';
import { radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type Props = {
  children: ReactNode;
};

export function AuthGlassCard({ children }: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 18 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 420 }}
      style={styles.outer}
    >
      <LinearGradient
        colors={['rgba(28,26,40,0.55)', 'rgba(18,16,32,0.78)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.borderGlow} pointerEvents="none" />
      <View style={styles.inner}>{children}</View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 28,
    overflow: 'hidden',
    marginHorizontal: AUTH_CARD_MARGIN_H,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F0D1A',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.38,
        shadowRadius: 28,
      },
      android: { elevation: 12 },
    }),
  },
  borderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.22)',
  },
  inner: {
    paddingVertical: spacing.lg,
    paddingHorizontal: AUTH_CARD_PADDING_H,
  },
});
