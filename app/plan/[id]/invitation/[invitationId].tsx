/**
 * Guest — view and respond to a host invitation.
 */
import { Avatar } from '@/components/Avatar';
import { PlanStackScreenHeader } from '@/components/navigation/PlanStackScreenHeader';
import { Screen } from '@/components/Screen';
import { PlanSummaryCard } from '@/components/plans/agreement/PlanSummaryCard';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { resolveJoinRequestSlotCentsLabel } from '@/lib/plans/joinRequestSlotDisplay';
import { invitationExpiryBannerLabel } from '@/lib/plans/invitationErrors';
import { navigateAfterInvitationAccept } from '@/lib/plans/invitationAcceptNavigation';
import { peekPlanDetailSeed } from '@/lib/plans/planDetailSeed';
import {
  fetchMyInvitation,
  respondToInvitation,
  type PlanInvitationRow,
} from '@/lib/plans/planInvitations';
import { isUserVerified } from '@/lib/verification/access';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const ACCEPT_GRADIENT = [colors.primary, colors.secondary] as const;
const DISABLED_GRADIENT = [colors.border, colors.border] as const;

const DECLINE_REASONS = [
  'I can no longer make it',
  'Schedule conflict',
  'Budget constraints',
  'Personal reasons',
  'Found alternative plans',
  'Other',
] as const;

type DeclineReason = (typeof DECLINE_REASONS)[number];

export default function InvitationDetailScreen() {
  const { id: planId, invitationId } = useLocalSearchParams<{
    id: string;
    invitationId: string;
  }>();
  const { user, dbUser } = useAuth();
  const [invitation, setInvitation] = useState<PlanInvitationRow | null>(null);
  const [plan, setPlan] = useState<DbPlan | null>(() =>
    planId ? peekPlanDetailSeed(planId) : null
  );
  const [hostName, setHostName] = useState<string | null>(null);
  const [hostAvatar, setHostAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [showDeclineSheet, setShowDeclineSheet] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason | null>(null);
  const [declineOther, setDeclineOther] = useState('');

  const isKycApproved = isUserVerified(dbUser?.verification_status);

  const load = useCallback(async () => {
    if (!planId || !invitationId || !user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: planRow }, inv] = await Promise.all([
        supabase.from('plans').select('*').eq('id', planId).single(),
        fetchMyInvitation(invitationId),
      ]);
      if (planRow) setPlan(planRow as DbPlan);
      setInvitation(inv);

      if (inv?.host_id) {
        const { data: hostProf } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', inv.host_id)
          .maybeSingle();
        setHostName(hostProf?.display_name ?? null);
        setHostAvatar(hostProf?.avatar_url ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [planId, invitationId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!invitationId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`plan-invitation-${invitationId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_invitations',
          filter: `id=eq.${invitationId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [invitationId, load]);

  function handleRespondError(err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'KYC_REQUIRED') {
      Alert.alert(
        'Verification required',
        'Complete your identity verification to accept this invitation.',
        [
          { text: 'Verify now', onPress: () => router.push('/kyc' as Href) },
          { text: 'Later', style: 'cancel' },
        ]
      );
    } else if (msg === 'EXPIRED') {
      Alert.alert('Invitation expired', 'This invitation is no longer valid.');
      router.replace('/(tabs)' as Href);
    } else if (msg === 'PLAN_FULL') {
      Alert.alert('Plan is full', 'All slots have been filled.');
    } else if (msg === 'ALREADY_RESPONDED') {
      if (!planId || !invitationId) {
        Alert.alert('Already responded', 'You have already responded to this invitation.');
        return;
      }
      void (async () => {
        const fresh = await fetchMyInvitation(invitationId);
        if (fresh?.status === 'accepted') {
          navigateAfterInvitationAccept(planId, { isNegotiable: plan?.is_negotiable !== false });
          return;
        }
        Alert.alert('Already responded', 'You have already responded to this invitation.');
        void load();
      })();
    } else {
      Alert.alert('Could not respond', 'Something went wrong. Please try again.', [{ text: 'OK' }]);
    }
  }

  const handleRespond = async (action: 'accept' | 'decline') => {
    if (!invitationId || !planId) return;
    setIsResponding(true);
    try {
      const result = await respondToInvitation(invitationId, action);

      if (action === 'accept') {
        navigateAfterInvitationAccept(planId, result);
      } else {
        router.replace('/(tabs)' as Href);
      }
    } catch (err: unknown) {
      handleRespondError(err);
    } finally {
      setIsResponding(false);
    }
  };

  async function handleDeclineWithReason(reason: DeclineReason, other?: string) {
    if (!invitationId) return;
    setIsResponding(true);
    try {
      await respondToInvitation(invitationId, 'decline', reason, other);
      setShowDeclineSheet(false);
      setDeclineReason(null);
      setDeclineOther('');
      router.replace('/(tabs)' as Href);
    } catch (err: unknown) {
      handleRespondError(err);
    } finally {
      setIsResponding(false);
    }
  }

  const expiryLabel = useMemo(
    () => (invitation ? invitationExpiryBannerLabel(invitation.expires_at) : ''),
    [invitation]
  );

  if (loading || !plan) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
        <PlanStackScreenHeader title="Invitation" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (!invitation) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
        <PlanStackScreenHeader title="Invitation" />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Invitation not found</Text>
          <Text style={styles.emptyBody}>This invitation may have been removed or expired.</Text>
        </View>
      </Screen>
    );
  }

  const isExpired =
    invitation.status === 'expired' || new Date(invitation.expires_at).getTime() < Date.now();
  const shareLabel = resolveJoinRequestSlotCentsLabel(plan);
  const hostLabel = hostName?.trim() || 'Your host';

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} scroll={false}>
      <AppShellBackground />
      <PlanStackScreenHeader title="Invitation" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <PlanSummaryCard
          planTitle={plan.title?.trim() || 'Meetup'}
          location={plan.location_label}
          whenLabel={formatPlanWhen(plan)}
          priceLabel={shareLabel || 'Formula share'}
          notes={plan.description}
        />

        <View style={styles.hostCard}>
          <Avatar uri={hostAvatar} name={hostLabel} size={48} />
          <View style={styles.hostCopy}>
            <Text style={styles.hostKicker}>Invited by</Text>
            <Text style={styles.hostName}>{hostLabel}</Text>
          </View>
        </View>

        {shareLabel ? (
          <View style={styles.shareCard}>
            <Text style={styles.shareLabel}>Your share if you join</Text>
            <Text style={styles.shareAmount}>{shareLabel}</Text>
            {plan.is_negotiable !== false ? (
              <Text style={styles.shareNote}>
                This is the formula price. You can negotiate after accepting.
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isExpired && invitation.status === 'pending' ? (
          <View style={styles.expiryBanner}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.expiryText}>Invitation expires in {expiryLabel}</Text>
          </View>
        ) : null}

        {isExpired ? (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredText}>This invitation has expired.</Text>
          </View>
        ) : null}

        {!isKycApproved && !isExpired && invitation.status === 'pending' ? (
          <View style={styles.kycBanner}>
            <Ionicons name="shield-outline" size={16} color={colors.primary} />
            <Text style={styles.kycBannerText}>
              Complete your identity verification to accept this invitation.
            </Text>
            <Pressable onPress={() => router.push('/kyc' as Href)}>
              <Text style={styles.kycBannerLink}>Verify now</Text>
            </Pressable>
          </View>
        ) : null}

        {!isExpired && invitation.status === 'pending' ? (
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleRespond('accept')}
              disabled={!isKycApproved || isResponding}
              style={({ pressed }) => [pressed && isKycApproved && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={isKycApproved ? ACCEPT_GRADIENT : DISABLED_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptButton}
              >
                <Text style={styles.acceptButtonLabel}>
                  {isResponding ? 'Confirming…' : 'Accept invitation'}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.declineButton}
              onPress={() => setShowDeclineSheet(true)}
              disabled={isResponding}
            >
              <Text style={styles.declineButtonLabel}>Decline</Text>
            </Pressable>
          </View>
        ) : null}

        {invitation.status === 'accepted' ? (
          <View style={styles.respondedBanner}>
            <Text style={styles.respondedText}>You accepted this invitation.</Text>
          </View>
        ) : null}

        {invitation.status === 'declined' ? (
          <View style={styles.respondedBanner}>
            <Text style={styles.respondedText}>You declined this invitation.</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showDeclineSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeclineSheet(false)}
      >
        <View style={styles.declineSheetOverlay}>
          <View style={styles.declineSheet}>
            <Text style={styles.declineSheetTitle}>Why are you declining?</Text>
            <Text style={styles.declineSheetSub}>Your reason helps the host understand.</Text>

            <ScrollView style={styles.declineReasonList}>
              {DECLINE_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => setDeclineReason(reason)}
                  style={[
                    styles.declineReasonRow,
                    declineReason === reason && styles.declineReasonRowSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.declineRadio,
                      declineReason === reason && styles.declineRadioSelected,
                    ]}
                  >
                    {declineReason === reason ? <View style={styles.declineRadioInner} /> : null}
                  </View>
                  <Text
                    style={[
                      styles.declineReasonTxt,
                      declineReason === reason && styles.declineReasonTxtSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {declineReason === 'Other' ? (
              <TextInput
                value={declineOther}
                onChangeText={setDeclineOther}
                placeholder="Please tell us more..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                maxLength={300}
                style={styles.declineOtherInput}
                textAlignVertical="top"
              />
            ) : null}

            <View style={styles.declineSheetActions}>
              <Pressable
                style={styles.declineCancelBtn}
                onPress={() => {
                  setShowDeclineSheet(false);
                  setDeclineReason(null);
                  setDeclineOther('');
                }}
              >
                <Text style={styles.declineCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.declineConfirmBtn,
                  (!declineReason || isResponding) && styles.declineConfirmBtnDisabled,
                ]}
                disabled={!declineReason || isResponding}
                onPress={() =>
                  void handleDeclineWithReason(
                    declineReason!,
                    declineReason === 'Other' ? declineOther : undefined
                  )
                }
              >
                <Text style={styles.declineConfirmTxt}>
                  {isResponding ? 'Declining...' : 'Confirm decline'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md },
  emptyCard: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 22,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.1)',
  },
  hostCopy: { flex: 1 },
  hostKicker: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  hostName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  shareCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.1)',
  },
  shareLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  shareAmount: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  shareNote: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  expiryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(232, 144, 8, 0.12)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  expiryText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.warning,
  },
  expiredBanner: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  expiredText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  kycBanner: {
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  kycBannerText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 20,
  },
  kycBannerLink: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  actionRow: { gap: spacing.sm, marginTop: spacing.sm },
  acceptButton: {
    minHeight: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  acceptButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  declineButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonLabel: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  respondedBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  respondedText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    textAlign: 'center',
  },
  declineSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  declineSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  declineSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  declineSheetSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  declineReasonList: {
    maxHeight: 280,
  },
  declineReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  declineReasonRowSelected: {},
  declineRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineRadioSelected: {
    borderColor: colors.primary,
  },
  declineRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  declineReasonTxt: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
    flex: 1,
  },
  declineReasonTxtSelected: {
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  declineOtherInput: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
    height: 80,
  },
  declineSheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  declineCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  declineCancelTxt: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  declineConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  declineConfirmBtnDisabled: {
    opacity: 0.45,
  },
  declineConfirmTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#DC2626',
  },
});
