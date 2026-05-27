/**
 * Shown when the host tries to boost a plan that is already boosted.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { formatBoostEndsAt, formatCountdownMs } from '@/lib/time/formatCountdown';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  boostedUntilIso: string;
  planTitle?: string | null;
  onClose: () => void;
};

export function PlanBoostActiveModal({ visible, boostedUntilIso, planTitle, onClose }: Props) {
  const endsAtMs = useMemo(() => new Date(boostedUntilIso).getTime(), [boostedUntilIso]);
  const endsLabel = useMemo(() => formatBoostEndsAt(boostedUntilIso), [boostedUntilIso]);
  const [remainMs, setRemainMs] = useState(() => Math.max(0, endsAtMs - Date.now()));

  useEffect(() => {
    if (!visible) return;
    const tick = () => setRemainMs(Math.max(0, endsAtMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visible, endsAtMs]);

  const countdown = formatCountdownMs(remainMs);
  const elapsed = remainMs <= 0;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.45)', 'rgba(255,101,132,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            <View style={styles.card}>
              <LinearGradient
                colors={['#F59E0B', colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGrad}
              >
                <Ionicons name="rocket" size={28} color="#fff" />
              </LinearGradient>

              <Text style={styles.kicker}>Visibility</Text>
              <Text style={styles.title}>Already boosted</Text>
              <Text style={styles.message}>
                {planTitle?.trim()
                  ? `“${planTitle.trim()}” is highlighted in Discover right now.`
                  : 'This plan is highlighted in Discover right now.'}{' '}
                {elapsed
                  ? 'You can boost again now.'
                  : 'Wait for the timer below to finish, then tap Boost plan again.'}
              </Text>

              <LinearGradient
                colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.12)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.timerRing}
              >
                <View style={styles.timerInner}>
                  <Text style={styles.timerEyebrow}>{elapsed ? 'Ready to boost' : 'Boost again in'}</Text>
                  <Text style={styles.timerValue} accessibilityLiveRegion="polite">
                    {elapsed ? '0:00' : countdown}
                  </Text>
                  {endsLabel && !elapsed ? (
                    <Text style={styles.timerSub}>Ends {endsLabel}</Text>
                  ) : null}
                </View>
              </LinearGradient>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                accessibilityRole="button"
                accessibilityLabel="Got it"
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGrad}
                >
                  <Text style={styles.ctaTxt}>Got it</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 29, 38, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheetHit: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  iconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  timerRing: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    padding: 2,
    marginBottom: spacing.lg,
  },
  timerInner: {
    borderRadius: radius.lg - 2,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  timerEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  timerSub: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  ctaOuter: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  ctaPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  ctaGrad: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  ctaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
