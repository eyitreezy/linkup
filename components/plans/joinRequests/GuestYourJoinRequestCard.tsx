import { Button } from '@/components/Button';
import { AppFeedbackModal } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  deriveGuestJoinRequestCardPhase,
  GUEST_JOIN_REQUEST_PENDING_COPY,
} from '@/lib/plans/guestJoinRequestCardState';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { confirmedGuestMeetupMessage } from '@/lib/plans/confirmedGuestMeetupCopy';
import type { PlanViewerContext } from '@/lib/plans/planViewerContext';
import type { DbPlan, JoinRequestStatus } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  plan: DbPlan;
  ctx: PlanViewerContext;
  myJoinRequest: { id: string; status: JoinRequestStatus } | null;
  planExpired: boolean;
  onOpenRequestSheet: () => void;
  onPayShare: () => void;
};

function statusChip(status: JoinRequestStatus) {
  switch (status) {
    case 'approved':
      return { label: 'Approved', bg: 'rgba(16, 185, 129, 0.14)', color: colors.success };
    case 'declined':
      return { label: 'Declined', bg: 'rgba(239, 68, 68, 0.12)', color: colors.danger };
    default:
      return { label: 'Pending', bg: 'rgba(94, 82, 255, 0.12)', color: colors.primary };
  }
}

export function GuestYourJoinRequestCard({
  plan,
  ctx,
  myJoinRequest,
  planExpired,
  onOpenRequestSheet,
  onPayShare,
}: Props) {
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const phase = deriveGuestJoinRequestCardPhase(ctx, myJoinRequest);
  const slotLabel = resolveJoinRequestSlotCentsLabel(plan);
  const chip = myJoinRequest?.status != null ? statusChip(myJoinRequest.status) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Your request</Text>
        <Text style={styles.subtitle}>Track your join request and next step for this plan.</Text>

        {phase === 'already_guest' ? (
          <View style={styles.body}>
            <View style={[styles.statusCard, styles.statusCardApproved]}>
              <View style={styles.statusTop}>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>You are already a guest</Text>
                  <Text style={styles.statusBody}>
                    {confirmedGuestMeetupMessage(plan)}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                  <Text style={[styles.chipText, { color: colors.success }]}>Confirmed</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {phase === 'group_filled' ? (
          <View style={styles.body}>
            <View style={styles.statusCard}>
              <View style={styles.statusTop}>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>Group filled</Text>
                  <Text style={styles.statusBody}>
                    This group plan has reached its guest capacity and is not accepting new
                    requests.
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(94, 82, 255, 0.12)' }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>Full</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {phase === 'can_request' ? (
          <View style={styles.body}>
            <View style={styles.emptyIconWrap}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconGrad}
              >
                <Ionicons name="hand-left-outline" size={28} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>No request yet</Text>
            <Text style={styles.emptyBody}>
              Request to join at the listed formula share. The host will review your request.
            </Text>
            <Button
              title="Request to join"
              onPress={onOpenRequestSheet}
              disabled={planExpired}
              pill
              style={styles.cta}
            />
          </View>
        ) : null}

        {phase === 'pending' ? (
          <View style={styles.body}>
            <View style={styles.statusCard}>
              <View style={styles.statusTop}>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>Join request sent</Text>
                  {slotLabel ? <Text style={styles.slotLabel}>{slotLabel}</Text> : null}
                  <Text style={styles.statusBody}>
                    Waiting for the host to approve your request.
                  </Text>
                </View>
                {chip ? (
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Button
              title="View request status"
              onPress={() => setPendingModalOpen(true)}
              pill
              style={styles.cta}
            />
          </View>
        ) : null}

        {phase === 'approved_pay' ? (
          <View style={styles.body}>
            <View style={[styles.statusCard, styles.statusCardApproved]}>
              <View style={styles.statusTop}>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>Request approved</Text>
                  {slotLabel ? <Text style={styles.slotLabel}>{slotLabel}</Text> : null}
                  <Text style={styles.statusBody}>
                    Payment required to confirm your place on this plan.
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                  <Text style={[styles.chipText, { color: colors.success }]}>Approved</Text>
                </View>
              </View>
            </View>
            <Button
              title={
                ctx.payShareAmountLabel
                  ? `Pay your share · ${ctx.payShareAmountLabel}`
                  : 'Pay your share'
              }
              onPress={onPayShare}
              pill
              style={styles.cta}
            />
          </View>
        ) : null}

        {phase === 'approved_done' ? (
          <View style={styles.body}>
            <View style={[styles.statusCard, styles.statusCardApproved]}>
              <View style={styles.statusTop}>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>You are on this plan</Text>
                  {slotLabel ? <Text style={styles.slotLabel}>{slotLabel}</Text> : null}
                  <Text style={styles.statusBody}>
                    Your join request was approved and payment is complete.
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                  <Text style={[styles.chipText, { color: colors.success }]}>Confirmed</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {phase === 'declined' ? (
          <View style={styles.body}>
            <View style={[styles.statusCard, styles.statusCardDeclined]}>
              <View style={styles.statusTop}>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>Request not approved</Text>
                  <Text style={styles.statusBody}>
                    The host did not approve your request for this plan.
                  </Text>
                </View>
                {chip ? (
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Button
              title="Explore other plans"
              onPress={() => router.push('/discover' as Href)}
              pill
              style={styles.cta}
            />
          </View>
        ) : null}

        {phase === 'closed' ? (
          <View style={styles.body}>
            <Text style={styles.emptyTitle}>Join requests closed</Text>
            <Text style={styles.emptyBody}>This plan is no longer accepting new join requests.</Text>
          </View>
        ) : null}
      </View>

      <AppFeedbackModal
        visible={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        variant="info"
        title={GUEST_JOIN_REQUEST_PENDING_COPY.title}
        message={GUEST_JOIN_REQUEST_PENDING_COPY.message}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl + spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.14)',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
  },
  body: { marginTop: spacing.md },
  emptyIconWrap: { alignSelf: 'center', marginBottom: spacing.md },
  emptyIconGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  emptyBody: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 20,
  },
  statusCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    backgroundColor: 'rgba(250, 250, 255, 0.9)',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusCardApproved: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  statusCardDeclined: {
    borderColor: 'rgba(239, 68, 68, 0.15)',
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  slotLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  statusBody: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
  },
  cta: { marginTop: spacing.xs },
});
