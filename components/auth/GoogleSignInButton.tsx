/**
 * Google sign-in — branded outline button (OAuth via Supabase).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, ActivityIndicator } from 'react-native';

type Props = {
  onPress: () => void;
  loading?: boolean;
  label?: string;
  /** Elevated white button for use on gradient/cards */
  elevated?: boolean;
  fullWidth?: boolean;
};

export function GoogleSignInButton({
  onPress,
  loading,
  label = 'Continue with Google',
  elevated,
  fullWidth,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        elevated && styles.elevated,
        fullWidth && styles.fullWidth,
        {
          transform: [{ scale: pressed && !loading ? 0.97 : 1 }],
        },
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Ionicons name="logo-google" size={22} color="#4285F4" />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 52,
  },
  elevated: {
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#2D2640',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 54,
    borderRadius: radius.button,
  },
  pressed: { opacity: 0.94, backgroundColor: '#FAFAFE' },
  disabled: { opacity: 0.65 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
});
