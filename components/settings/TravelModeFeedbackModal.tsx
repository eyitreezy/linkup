/**
 * Travel mode save / clear / error feedback — inbox-grade modal (replaces system Alert).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export type TravelModeFeedback =
  | { kind: 'saved'; label: string }
  | { kind: 'cleared' }
  | { kind: 'error'; message: string };

type Props = {
  feedback: TravelModeFeedback | null;
  onClose: () => void;
};

export function TravelModeFeedbackModal({ feedback, onClose }: Props) {
  const visible = feedback != null;

  const isError = feedback?.kind === 'error';
  const isCleared = feedback?.kind === 'cleared';
  const locationLabel = feedback?.kind === 'saved' ? feedback.label : null;

  const title = isError ? 'Could not save' : isCleared ? 'Travel mode off' : "You're all set";
  const message = isError
    ? feedback.message
    : isCleared
      ? 'The Plans tab will use your home location again. Turn travel mode back on anytime.'
      : 'Meetups and distances on the Plans tab now use this travel pin.';

  const iconName = isError ? 'alert-circle-outline' : isCleared ? 'home-outline' : 'airplane';
  const iconGrad = isError
    ? ([colors.danger, '#F87171'] as const)
    : isCleared
      ? ([colors.textMuted, '#9CA3AF'] as const)
      : ([colors.primary, colors.secondary] as const);

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
              <LinearGradient colors={[...iconGrad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconGrad}>
                <Ionicons name={iconName} size={28} color="#fff" />
              </LinearGradient>

              <Text style={styles.kicker}>Travel mode</Text>
              <Text style={styles.title}>{title}</Text>

              {locationLabel ? (
                <View style={styles.locationChip}>
                  <Ionicons name="location" size={18} color={colors.primary} />
                  <Text style={styles.locationChipTxt} numberOfLines={2}>
                    {locationLabel}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.message}>{message}</Text>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                accessibilityRole="button"
                accessibilityLabel="Got it"
              >
                <LinearGradient
                  colors={isError ? [colors.danger, '#F87171'] : [colors.primary, colors.secondary]}
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
  sheetHit: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
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
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  locationChipTxt: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 22,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
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
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
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
