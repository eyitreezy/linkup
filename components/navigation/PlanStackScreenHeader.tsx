/**
 * In-screen title bar for plan/[id] flows.
 * Top safe area must come from the parent `Screen` (`safeAreaEdges` includes `top`) — same pattern as the home feed header.
 */
import { PlanStackHeaderBack } from '@/components/navigation/PlanStackHeaderBack';
import { colors, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

const BACK_SLOT = 44;

type Props = { title: string };

export function PlanStackScreenHeader({ title }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.backSlot}>
        <PlanStackHeaderBack />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.backSlot} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backSlot: {
    width: BACK_SLOT,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
});
