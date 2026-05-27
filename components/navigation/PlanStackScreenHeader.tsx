/**
 * In-screen title bar for plan/[id] flows.
 * Top safe area must come from the parent `Screen` (`safeAreaEdges` includes `top`) — same pattern as the home feed header.
 */
import { PlanStackHeaderBack } from '@/components/navigation/PlanStackHeaderBack';
import { colors, spacing } from '@/constants/theme';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

const BACK_SLOT = 44;

type Props = {
  title: string;
  barStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  /** Trailing action (e.g. report). */
  right?: ReactNode;
};

export function PlanStackScreenHeader({ title, barStyle, titleStyle, right }: Props) {
  return (
    <View style={[styles.bar, barStyle]}>
      <View style={styles.backSlot}>
        <PlanStackHeaderBack />
      </View>
      <Text style={[styles.title, titleStyle]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.backSlot, styles.backSlotRight]}>{right}</View>
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
  backSlotRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
});
