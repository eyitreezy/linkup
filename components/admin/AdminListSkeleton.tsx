/**
 * Generic admin list/card skeleton — used on pull-to-refresh and initial load.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';

function CardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <MotiView
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900, delay }}
          style={styles.titleBone}
        />
        <MotiView
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900, delay: delay + 80 }}
          style={styles.chipBone}
        />
      </View>
      <MotiView
        from={{ opacity: 0.35 }}
        animate={{ opacity: 0.85 }}
        transition={{ loop: true, type: 'timing', duration: 900, delay: delay + 120 }}
        style={styles.metaBone}
      />
      <MotiView
        from={{ opacity: 0.35 }}
        animate={{ opacity: 0.85 }}
        transition={{ loop: true, type: 'timing', duration: 900, delay: delay + 160 }}
        style={styles.bodyBone}
      />
    </View>
  );
}

export function AdminListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading admin list">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} delay={i * 60} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingBottom: spacing.md },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleBone: {
    flex: 1,
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(94, 82, 255, 0.14)',
  },
  chipBone: {
    width: 72,
    height: 24,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
  },
  metaBone: {
    width: '46%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
  },
  bodyBone: {
    width: '88%',
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(94, 82, 255, 0.06)',
  },
});
