/**
 * Skeletal placeholders for Admin meet types list — matches row card layout.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';

function MeetTypeRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <MotiView
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900 }}
          style={styles.titleBone}
        />
        <MotiView
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900, delay: 80 }}
          style={styles.slugBone}
        />
        <View style={styles.badgeRow}>
          <MotiView
            from={{ opacity: 0.35 }}
            animate={{ opacity: 0.85 }}
            transition={{ loop: true, type: 'timing', duration: 900, delay: 120 }}
            style={styles.badgeBone}
          />
          <MotiView
            from={{ opacity: 0.35 }}
            animate={{ opacity: 0.85 }}
            transition={{ loop: true, type: 'timing', duration: 900, delay: 160 }}
            style={styles.badgeBone}
          />
        </View>
      </View>
      <View style={styles.rowActions}>
        <MotiView
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900, delay: 200 }}
          style={styles.actionBone}
        />
        <MotiView
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900, delay: 240 }}
          style={styles.iconBone}
        />
        <MotiView
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900, delay: 280 }}
          style={styles.iconBone}
        />
      </View>
    </View>
  );
}

export function AdminMeetTypesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading meet types">
      <MotiView
        from={{ opacity: 0.35 }}
        animate={{ opacity: 0.85 }}
        transition={{ loop: true, type: 'timing', duration: 900 }}
        style={styles.sectionTitleBone}
      />
      {Array.from({ length: count }, (_, i) => (
        <MeetTypeRowSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  sectionTitleBone: {
    height: 18,
    width: '42%',
    borderRadius: 6,
    backgroundColor: 'rgba(94, 82, 255, 0.14)',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  rowMain: { flex: 1, gap: 8 },
  titleBone: {
    height: 16,
    width: '72%',
    borderRadius: 6,
    backgroundColor: 'rgba(94, 82, 255, 0.14)',
  },
  slugBone: {
    height: 12,
    width: '48%',
    borderRadius: 6,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
  },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badgeBone: {
    height: 20,
    width: 64,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
  },
  rowActions: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  actionBone: {
    width: 52,
    height: 28,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
  },
  iconBone: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
  },
});
