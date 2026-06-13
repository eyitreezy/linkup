import { colors, radius } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  deadline: string;
};

export function SlaDeadlineBadge({ deadline }: Props) {
  const hoursRemaining = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  const overdue = hoursRemaining <= 0;
  const urgent = !overdue && hoursRemaining < 6;
  const warning = !overdue && hoursRemaining < 12;

  const label = overdue
    ? 'Overdue'
    : hoursRemaining < 1
      ? '<1h left'
      : `${Math.round(hoursRemaining)}h left`;

  const bg = overdue
    ? 'rgba(239, 68, 68, 0.14)'
    : urgent
      ? 'rgba(239, 68, 68, 0.12)'
      : warning
        ? 'rgba(245, 158, 11, 0.14)'
        : 'rgba(107, 114, 128, 0.12)';

  const fg = overdue || urgent ? colors.danger : warning ? '#B45309' : colors.textMuted;

  const border = overdue || urgent
    ? 'rgba(239, 68, 68, 0.28)'
    : warning
      ? 'rgba(245, 158, 11, 0.28)'
      : 'rgba(107, 114, 128, 0.2)';

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.txt, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  txt: {
    fontSize: 12,
    fontWeight: '800',
  },
});
