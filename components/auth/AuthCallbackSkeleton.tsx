/**
 * Post-login / email-confirm loading shell — matches Discover feed skeleton language.
 */
import { PlansFeedSkeleton } from '@/components/plans/PlansFeedSkeleton';
import { Screen } from '@/components/Screen';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
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

export function AuthCallbackSkeleton() {
  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screen}>
      <AppShellBackground />
      <View style={styles.header}>
        <PulseBlock style={styles.headerIcon} />
        <View style={styles.headerTextCol}>
          <PulseBlock style={styles.lineSm} />
          <PulseBlock style={styles.lineLg} />
        </View>
      </View>
      <View style={styles.tabRow}>
        <PulseBlock style={styles.tabPill} />
        <PulseBlock style={styles.tabPill} />
        <PulseBlock style={styles.tabPill} />
      </View>
      <PlansFeedSkeleton />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  block: { backgroundColor: '#E8EAEF', borderRadius: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerIcon: { width: 44, height: 44, borderRadius: 14 },
  headerTextCol: { flex: 1, gap: 8 },
  lineSm: { height: 12, width: '35%', borderRadius: 6 },
  lineLg: { height: 18, width: '55%', borderRadius: 6 },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tabPill: { height: 32, flex: 1, borderRadius: radius.button },
});
