import { evaluatePasswordStrength } from '@/lib/auth/passwordStrength';
import { spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = { password: string };

export function PasswordStrengthIndicator({ password }: Props) {
  if (!password) return null;
  const strength = evaluatePasswordStrength(password);

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              i < strength.score && { backgroundColor: strength.color },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: strength.color }]}>{strength.label}</Text>
      {strength.hints.length > 0 ? (
        <Text style={styles.hint}>{strength.hints.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: spacing.sm },
  bars: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  label: { fontSize: 12, fontWeight: '800' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4, lineHeight: 16 },
});
