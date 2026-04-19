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
};

export function GoogleSignInButton({
  onPress,
  loading,
  label = 'Continue with Google',
  elevated,
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
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  pressed: { opacity: 0.92, backgroundColor: colors.background },
  disabled: { opacity: 0.7 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
});
