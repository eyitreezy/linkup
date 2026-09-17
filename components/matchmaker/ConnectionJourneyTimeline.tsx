import { MilestoneRow } from '@/components/matchmaker/MilestoneRow';
import type { JourneyMilestone } from '@/lib/matchmaker/connection';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  milestones: JourneyMilestone[];
};

export function ConnectionJourneyTimeline({ milestones }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Connection Journey</Text>
      {milestones.map((m, i) => (
        <MilestoneRow
          key={m.label}
          label={m.label}
          done={m.done}
          active={m.active}
          dateLabel={m.dateLabel}
          isLast={i === milestones.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: MM.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bold,
    fontWeight: '800',
    color: MM.text,
    marginBottom: spacing.sm,
  },
});
