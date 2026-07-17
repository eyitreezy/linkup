import { Avatar } from '@/components/Avatar';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import type { JoinRequestWithRequester } from '@/lib/plans/joinRequests';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function statusChip(status: JoinRequestWithRequester['status']) {
  switch (status) {
    case 'approved':
      return { label: 'Approved', bg: 'rgba(16, 185, 129, 0.14)', color: colors.success };
    case 'declined':
      return { label: 'Declined', bg: 'rgba(239, 68, 68, 0.12)', color: colors.danger };
    default:
      return { label: 'Pending', bg: 'rgba(94, 82, 255, 0.12)', color: colors.primary };
  }
}

type Props = {
  request: JoinRequestWithRequester;
  onApprove?: () => void;
  onDecline?: () => void;
  busy?: boolean;
};

export function JoinRequestRow({ request, onApprove, onDecline, busy }: Props) {
  const name = request.requester?.display_name?.trim() || 'Guest';
  const chip = statusChip(request.status);

  return (
    <View style={styles.card}>
      <View style={styles.guestRow}>
        <Avatar uri={request.requester?.avatar_url} name={name} size={44} />
        <View style={styles.guestMeta}>
          <Text style={styles.guestName} numberOfLines={1}>
            {name}
          </Text>
          {request.message ? (
            <Text style={styles.message} numberOfLines={3}>
              {request.message}
            </Text>
          ) : (
            <Text style={styles.messageMuted}>No message</Text>
          )}
        </View>
      </View>

      {request.status === 'pending' && onApprove && onDecline ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onApprove}
            style={({ pressed }) => [styles.actionOuter, styles.actionFlex, pressed && !busy && styles.pressed]}
          >
            <LinearGradient
              colors={[...APP_CTA_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.approveGrad}
            >
              <Text style={styles.approveTxt}>Approve</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onDecline}
            style={({ pressed }) => [styles.actionOuter, styles.actionFlex, pressed && !busy && styles.pressed]}
          >
            <LinearGradient
              colors={[...APP_CTA_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.declineRing}
            >
              <View style={styles.declineInner}>
                <Text style={styles.declineTxt}>Decline</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Ionicons
            name={
              request.status === 'approved'
                ? 'checkmark-circle-outline'
                : request.status === 'declined'
                  ? 'close-circle-outline'
                  : 'time-outline'
            }
            size={14}
            color={chip.color}
          />
          <Text style={[styles.chipTxt, { color: chip.color }]}>{chip.label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    marginBottom: spacing.sm,
  },
  guestRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  guestMeta: { flex: 1, minWidth: 0 },
  guestName: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 20,
  },
  messageMuted: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionOuter: { borderRadius: radius.button, overflow: 'hidden', minHeight: 48 },
  actionFlex: { flex: 1 },
  approveGrad: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  approveTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  declineRing: { padding: 1.5, borderRadius: radius.button, minHeight: 48 },
  declineInner: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.button - 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 45,
  },
  declineTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipTxt: { fontSize: 12, fontWeight: '800', fontFamily: fonts.bold },
});
