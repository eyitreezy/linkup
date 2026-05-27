import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title?: string;
  subtitle?: string;
  expiredAtIso?: string | null;
};

/** Premium “shelf” callout when a mood plan’s window closed — creator + read-only viewers. */
export function ExpiredPlanShelfBanner({ title, subtitle, expiredAtIso }: Props) {
  const when = expiredAtIso
    ? new Date(expiredAtIso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(100,116,139,0.12)', 'rgba(148,163,184,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <View style={styles.iconRing}>
          <Ionicons name="moon-outline" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.textCol}>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>Expired</Text>
            {when ? <Text style={styles.when}>{when}</Text> : null}
          </View>
          <Text style={styles.title}>{title ?? 'This mood moment ended'}</Text>
          <Text style={styles.sub}>
            {subtitle ??
              'It stays on your shelf for reflection — editing, negotiation, escrow, and boosts are paused for this thread.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  row: { flexDirection: 'row', padding: spacing.md, gap: spacing.md, alignItems: 'flex-start' },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  textCol: { flex: 1, gap: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: {
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(100,116,139,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  when: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  sub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, fontWeight: '500' },
});
