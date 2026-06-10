import { colors, radius, spacing } from '@/constants/theme';
import type { EscrowTimelineItem } from '@/lib/escrow/buildEscrowTimeline';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

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
      <LinearGradient
        colors={['rgba(108,99,255,0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topRule}
      />
      <Text style={styles.kicker}>Activity</Text>
      <Text style={styles.title}>Escrow timeline</Text>
      {items.map((item, i) => {
        const c = toneColor(item.tone);
        const isLast = i === items.length - 1;
        return (
          <View key={item.key + String(i)} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.bullet, { borderColor: c }, item.tone === 'done' && styles.bulletDone]}>
                {item.tone === 'done' ? (
                  <Ionicons name="checkmark" size={14} color={colors.success} />
                ) : item.tone === 'warn' ? (
                  <Ionicons name="alert" size={14} color={c} />
                ) : item.tone === 'current' ? (
                  <View style={[styles.dot, { backgroundColor: c }]} />
                ) : (
                  <View style={styles.dotEmpty} />
                )}
              </View>
              {!isLast ? <View style={[styles.connector, item.tone === 'done' && styles.connectorDone]} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={[styles.itemTitle, item.tone === 'current' && styles.itemTitleCurrent]}>{item.title}</Text>
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
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  topRule: { height: 3, borderRadius: 2, marginBottom: spacing.md },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: spacing.md, letterSpacing: -0.3 },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  rail: { alignItems: 'center', width: 28 },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: radius.button,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  bulletDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: colors.success,
  },
  connector: {
    flex: 1,
    width: 2,
    minHeight: 16,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  connectorDone: { backgroundColor: 'rgba(16, 185, 129, 0.35)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  body: { flex: 1, paddingBottom: spacing.sm },
  itemTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  itemTitleCurrent: { color: colors.primary },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20, fontWeight: '600' },
  time: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
});
