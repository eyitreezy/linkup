import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function EscrowFundCTA({ title, subtitle, onPress, disabled, loading }: Props) {
  const off = disabled || loading;
  return (
    <View style={styles.wrap}>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      <Pressable
        onPress={onPress}
        disabled={off}
        style={({ pressed }) => [styles.outer, pressed && !off && { opacity: 0.94, transform: [{ scale: 0.985 }] }]}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={off ? [colors.border, colors.border] : [colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.grad}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.txt, off && styles.txtMuted]}>{title}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  outer: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.26,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
    }),
  },
  grad: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  txtMuted: { color: 'rgba(255,255,255,0.72)' },
});
