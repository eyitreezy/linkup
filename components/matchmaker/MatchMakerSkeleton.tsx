import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MatchMakerSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MatchMakerTabIcon size={22} color={MM.accent} active />
        <Text style={styles.headerTitle}>MatchMaker</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.block} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  block: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: MM.surfaceWarm,
    maxHeight: 420,
  },
});
