/**
 * Inline card when foreground location is not granted.
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  onAllow: () => void;
  onNotNow: () => void;
};

export function PlansLocationPrompt({ onAllow, onNotNow }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="navigate-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Enable location to see plans near you</Text>
          <Text style={styles.body}>We use your approximate area to sort and show relevant plans. You can change this anytime in settings.</Text>
        </View>
      </View>
      <View style={styles.btns}>
        <Button title="Allow" onPress={onAllow} style={styles.allow} />
        <Button title="Not now" variant="ghost" onPress={onNotNow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  btns: { marginTop: spacing.md, gap: spacing.sm },
  allow: { marginBottom: 0 },
});
