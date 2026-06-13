import { colors, radius, spacing } from '@/constants/theme';
import type { DbTicketReply } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  reply: DbTicketReply;
  showInternal?: boolean;
};

export function TicketReplyBubble({ reply, showInternal = false }: Props) {
  if (reply.is_internal && !showInternal) return null;

  const isAdmin = reply.sender_role === 'admin' || reply.sender_role === 'system';
  const isInternal = reply.is_internal;

  return (
    <View
      style={[
        styles.row,
        isAdmin ? styles.rowAdmin : styles.rowMember,
        isInternal && styles.rowInternal,
      ]}
    >
      {isInternal ? (
        <View style={styles.internalHead}>
          <Ionicons name="lock-closed-outline" size={12} color="#B45309" />
          <Text style={styles.internalLbl}>Internal note</Text>
        </View>
      ) : null}
      <Text style={[styles.body, isAdmin && !isInternal && styles.bodyAdmin]}>{reply.body}</Text>
      <Text style={styles.time}>
        {new Date(reply.created_at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    maxWidth: '92%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  rowAdmin: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  rowMember: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(107, 114, 128, 0.18)',
  },
  rowInternal: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  internalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  internalLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  bodyAdmin: {
    color: colors.text,
  },
  time: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
