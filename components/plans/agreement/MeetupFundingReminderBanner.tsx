/**
 * Shown when meetup is soon and escrow funding is still pending — aligns with push/email urgency copy.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { meetupHoursUntilLabel } from '@/lib/escrow/escrowPaymentPreview';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

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
      <Ionicons name="alarm-outline" size={22} color={colors.warning} />
      <View style={styles.col}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
        <Text style={styles.hint}>
          Automated push and email reminders are sent if notifications are on in Settings.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  col: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 20 },
  hint: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 8, lineHeight: 17, fontStyle: 'italic' },
});
