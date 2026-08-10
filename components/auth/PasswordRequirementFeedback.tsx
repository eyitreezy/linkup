import { getPasswordRequirements } from '@/lib/auth/passwordStrength';
import { fonts, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  password: string;
  /** When false, hide until the user has typed or attempted submit. */
  visible?: boolean;
};

export function PasswordRequirementFeedback({ password, visible = true }: Props) {
  if (!visible) return null;

  const requirements = getPasswordRequirements(password);

  return (
    <View style={styles.wrap}>
      {requirements.map((req) => (
        <Text
          key={req.key}
          style={[styles.line, req.satisfied ? styles.lineMet : styles.lineUnmet]}
        >
          {req.message}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
    marginBottom: spacing.sm,
    gap: 4,
  },
  line: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
  lineUnmet: {
    color: '#FCA5A5',
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  lineMet: {
    color: 'rgba(255,255,255,0.45)',
  },
});
