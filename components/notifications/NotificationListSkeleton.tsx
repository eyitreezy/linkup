import { colors, radius, spacing } from '@/constants/theme';
import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';

const ROWS = 6;

export function NotificationListSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading notifications">
      {Array.from({ length: ROWS }).map((_, i) => (
        <MotiView
          key={i}
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.85 }}
          transition={{ loop: true, type: 'timing', duration: 900 }}
          style={styles.row}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  row: {
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
  },
});
