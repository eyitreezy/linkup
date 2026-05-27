/**
 * Inbox empty — warm dating-app tone (connection-first, not marketplace).
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  onBrowsePlansPress: () => void;
};

const TIPS = [
  { icon: 'heart-outline' as const, text: 'Swipe or open a meetup you like, then jump into chat', tint: colors.primary },
  { icon: 'flash-outline' as const, text: 'Use “Active” above when you have plans in motion', tint: colors.secondary },
  { icon: 'shield-checkmark-outline' as const, text: 'Meet in public first — trust builds over time', tint: '#059669' },
];

export function MessagesEmptyState({ onBrowsePlansPress }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(108, 99, 255, 0.35)', 'rgba(255, 101, 132, 0.3)', 'rgba(16, 185, 129, 0.2)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.artRingOuter}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(248,244,255,0.98)']}
          style={styles.artRingInner}
        >
          <Text style={styles.emoji} accessibilityLabel="Envelope heart">
            💌
          </Text>
        </LinearGradient>
      </LinearGradient>
      <Text style={styles.title}>
        Your inbox is <Text style={styles.titleAccent}>quiet</Text>
      </Text>
      <Text style={styles.sub}>
        When you match on a hangout or say hi, conversations land here — keep it flirty, clear, and kind.
      </Text>
      <View style={styles.tips}>
        <View style={styles.tipsHead}>
          <Ionicons name="sparkles" size={18} color={colors.secondary} />
          <Text style={styles.tipsLabel}>Easy wins</Text>
        </View>
        {TIPS.map((t) => (
          <View key={t.text} style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: `${t.tint}18` }]}>
              <Ionicons name={t.icon} size={18} color={t.tint} />
            </View>
            <Text style={styles.tip}>{t.text}</Text>
          </View>
        ))}
      </View>
        <LinearGradient
        colors={[colors.primary, '#8B7CFF', colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ctaShell}
      >
        <Button
          title="Discover people nearby"
          onPress={onBrowsePlansPress}
          pill
          variant="primary"
          style={styles.ctaInnerBtn}
          textStyle={styles.ctaInnerTxt}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl * 1.25,
    marginTop: spacing.md,
  },
  artRingOuter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 8,
  },
  artRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  emoji: { fontSize: 52 },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  titleAccent: { color: colors.secondary },
  sub: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
    fontWeight: '600',
  },
  tips: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    gap: spacing.sm,
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tipsLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 22, fontWeight: '600', paddingTop: 6 },
  ctaShell: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    borderRadius: radius.button,
    padding: 2,
  },
  ctaInnerBtn: {
    backgroundColor: '#fff',
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
  },
  ctaInnerTxt: { color: colors.primary, fontWeight: '900' },
});
