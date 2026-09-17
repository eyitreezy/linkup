import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  done: boolean;
  active?: boolean;
  dateLabel?: string;
  isLast?: boolean;
};

export function MilestoneRow({ label, done, active, dateLabel, isLast }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            done && styles.dotDone,
            active && !done && styles.dotActive,
          ]}
        >
          {done ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
        </View>
        {!isLast ? <View style={[styles.line, done && styles.lineDone]} /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, done && styles.labelDone, active && styles.labelActive]}>{label}</Text>
        {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  rail: { width: 24, alignItems: 'center' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: MM.disabled,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MM.surface,
  },
  dotDone: { backgroundColor: MM.primary, borderColor: MM.primary },
  dotActive: { borderColor: MM.accent },
  line: { flex: 1, width: 2, backgroundColor: MM.border, marginVertical: 2 },
  lineDone: { backgroundColor: MM.primary },
  copy: { flex: 1, paddingBottom: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.medium, color: MM.muted, lineHeight: 18 },
  labelDone: { color: MM.text, fontWeight: '700' },
  labelActive: { color: MM.accent, fontWeight: '800' },
  date: { fontSize: 11, fontFamily: fonts.regular, color: MM.muted, marginTop: 2 },
});
