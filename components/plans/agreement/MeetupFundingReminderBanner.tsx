/**
 * Shown when meetup is soon and escrow funding is still pending — aligns with push/email urgency copy.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { meetupHoursUntilLabel } from '@/lib/escrow/escrowPaymentPreview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  meetupIso: string | null | undefined;
  /** Payer should complete funding; host sees guest reminder. */
  role: 'payer' | 'host_waiting';
};

export function MeetupFundingReminderBanner({ meetupIso, role }: Props) {
  const when = meetupHoursUntilLabel(meetupIso);
  if (!when) return null;

  const title = role === 'payer' ? 'Meetup coming up — fund escrow' : 'Meetup soon — waiting on payment';
  const sub =
    role === 'payer'
      ? `Your plan starts ${when}. Complete secure payment on the next screen so you're covered before you meet.`
      : `Your plan starts ${when}. We'll notify you when your guest funds escrow — you can message them from here if needed.`;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.18)', 'rgba(255, 101, 132, 0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlow}
      />
      <View style={styles.iconWrap}>
        <Ionicons name="alarm-outline" size={22} color={colors.warning} />
      </View>
      <View style={styles.col}>
        <Text style={styles.kicker}>Time-sensitive</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
        <View style={styles.hintRow}>
          <Ionicons name="notifications-outline" size={14} color={colors.textMuted} />
          <Text style={styles.hint}>
            Automated push and email reminders run if notifications are on in Settings.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#B45309',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  col: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 4, letterSpacing: -0.2 },
  sub: { fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 20 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245, 158, 11, 0.25)',
  },
  hint: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted, lineHeight: 17 },
});
