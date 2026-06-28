/**
 * Empty state for the Messages inbox "Active" strip only — not the full inbox.
 */
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

const HINTS = [
  { icon: 'heart-outline' as const, label: 'Like a plan', tint: colors.primary },
  { icon: 'chatbubble-outline' as const, label: 'Start chatting', tint: colors.secondary },
  { icon: 'calendar-outline' as const, label: 'Meet up', tint: '#059669' },
];

export function MessagesActiveEmptyState() {
  return (
    <View style={styles.wrap}>
      <View style={styles.heroRow}>
        <LinearGradient
          colors={['rgba(94, 82, 255, 0.22)', 'rgba(255, 74, 114, 0.18)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconRing}
        >
          <View style={styles.iconInner}>
            <Ionicons name="flash-outline" size={22} color={colors.primary} />
          </View>
        </LinearGradient>
        <View style={styles.copy}>
          <Text style={styles.title}>Nothing active yet</Text>
          <Text style={styles.sub}>
            Chats and meetups in progress appear here — tap to jump back in fast.
          </Text>
        </View>
      </View>
      <View style={styles.hints}>
        {HINTS.map((h) => (
          <View key={h.label} style={styles.hintChip}>
            <View style={[styles.hintIcon, { backgroundColor: `${h.tint}14` }]}>
              <Ionicons name={h.icon} size={14} color={h.tint} />
            </View>
            <Text style={styles.hintTxt}>{h.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 16,
    padding: 2,
    marginTop: 2,
  },
  iconInner: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.25,
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 19,
  },
  hints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  hintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  hintIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTxt: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
    letterSpacing: 0.1,
  },
});
