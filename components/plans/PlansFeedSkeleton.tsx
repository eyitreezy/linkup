/**
 * Lightweight skeleton placeholders for plan cards (low-end friendly).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';

function PulseBlock({ style }: { style: object }) {
  return (
    <MotiView
      from={{ opacity: 0.45 }}
      animate={{ opacity: 0.9 }}
      transition={{ type: 'timing', duration: 900, loop: true }}
      style={[styles.block, style]}
    />
  );
}

export function PlansFeedSkeleton() {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading plans">
      {[0, 1, 2].map((k) => (
        <View key={k} style={styles.card}>
          <View style={styles.topRow}>
            <PulseBlock style={styles.avatar} />
            <View style={styles.metaCol}>
              <PulseBlock style={styles.lineLg} />
              <PulseBlock style={styles.lineSm} />
            </View>
          </View>
          <PulseBlock style={styles.image} />
          <PulseBlock style={styles.lineLg} />
          <PulseBlock style={styles.lineMd} />
          <View style={styles.footerRow}>
            <PulseBlock style={styles.pill} />
            <PulseBlock style={styles.pill} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, gap: spacing.md, paddingBottom: 100 },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  block: { backgroundColor: '#E8EAEF', borderRadius: 8 },
  topRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  metaCol: { flex: 1, gap: 8 },
  lineLg: { height: 14, width: '70%', borderRadius: 6 },
  lineMd: { height: 12, width: '90%', borderRadius: 6, marginTop: 8 },
  lineSm: { height: 12, width: '40%', borderRadius: 6 },
  image: { height: 140, width: '100%', borderRadius: radius.lg, marginBottom: spacing.md },
  footerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  pill: { height: 32, flex: 1, borderRadius: radius.md },
});
