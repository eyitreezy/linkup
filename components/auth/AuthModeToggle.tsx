/**
 * Login / Sign up segmented control — gradient fill on active segment (reliable touches).
 */
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AuthMode = 'login' | 'signup';

type Props = {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
};

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.segment}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
    >
      {selected ? (
        <LinearGradient
          colors={[...APP_CHIP_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.segmentGrad}
        >
          <Text style={[styles.label, styles.labelOn]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.segmentIdle}>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function AuthModeToggle({ mode, onChange }: Props) {
  return (
    <View style={styles.track}>
      <Segment label="Log in" selected={mode === 'login'} onPress={() => onChange('login')} />
      <Segment label="Sign up" selected={mode === 'signup'} onPress={() => onChange('signup')} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.button,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  segmentGrad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.button,
  },
  segmentIdle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.2,
  },
  labelOn: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
