import { colors, radius, spacing } from '@/constants/theme';
import type { EscrowTimelineItem } from '@/lib/escrow/buildEscrowTimeline';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

function toneColor(tone: EscrowTimelineItem['tone']) {
  switch (tone) {
    case 'done':
      return colors.success;
    case 'current':
      return colors.primary;
    case 'warn':
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

type Props = { items: EscrowTimelineItem[] };

export function EscrowTimeline({ items }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity</Text>
      {items.map((item, i) => {
        const c = toneColor(item.tone);
        return (
          <View key={item.key + String(i)} style={styles.row}>
            <View style={[styles.bullet, { borderColor: c }]}>
              {item.tone === 'done' ? (
                <Ionicons name="checkmark" size={14} color={c} />
              ) : item.tone === 'warn' ? (
                <Ionicons name="alert" size={14} color={c} />
              ) : item.tone === 'current' ? (
                <View style={[styles.dot, { backgroundColor: c }]} />
              ) : (
                <View style={styles.dotEmpty} />
              )}
            </View>
            <View style={styles.body}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.sub}>{item.subtitle}</Text> : null}
              {item.at ? (
                <Text style={styles.time}>
                  {new Date(item.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: radius.button,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  body: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  time: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
});
