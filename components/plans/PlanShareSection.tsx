/**
 * Plan detail share — off-screen card capture, share sheet, tracking.
 */
import { ShareCard } from '@/components/plans/ShareCard';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import {
  calculateGroupSuggestedShareCents,
  formatGroupSplitCents,
  isGroupSplitPlan,
} from '@/lib/plans/groupSplitDynamic';
import { usePlanShare } from '@/lib/plans/usePlanShare';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbMeetType, DbPlan } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

type HostMini = {
  display_name: string | null;
  verified_badge: boolean | null;
};

type Props = {
  plan: DbPlan;
  hostProfile?: HostMini | null;
  currentUserId?: string | null;
  participationClosed?: boolean;
  onExpiredShare?: () => void;
};

export function PlanShareSection({
  plan,
  hostProfile,
  currentUserId,
  participationClosed = false,
  onExpiredShare,
}: Props) {
  const insets = useSafeAreaInsets();
  const [meetType, setMeetType] = useState<Pick<DbMeetType, 'name' | 'meet_type_images'> | null>(
    null
  );
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!plan.meet_type_id || !isSupabaseConfigured) {
      setMeetType(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from('meet_types')
      .select('name, meet_type_images')
      .eq('id', plan.meet_type_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMeetType((data as Pick<DbMeetType, 'name' | 'meet_type_images'>) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [plan.meet_type_id]);

  const city = plan.location_label?.split(',')[0]?.trim() || 'Nigeria';
  const meetTypeName = meetType?.name ?? plan.category?.trim() ?? 'Meetup';
  const meetDate = plan.scheduled_at
    ? new Date(plan.scheduled_at).toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : undefined;

  const priceDisplay = useMemo(() => {
    if (isGroupSplitPlan(plan)) {
      const shareCents =
        plan.current_suggested_share_cents ?? calculateGroupSuggestedShareCents(plan);
      if (shareCents > 0) {
        return `From ${formatGroupSplitCents(shareCents, plan.currency)} / person`;
      }
    }
    if (plan.starting_price_cents != null && plan.starting_price_cents > 0) {
      return formatGroupSplitCents(plan.starting_price_cents, plan.currency);
    }
    return null;
  }, [plan]);

  const slotsLeft =
    plan.max_guests != null
      ? Math.max(0, plan.max_guests - (plan.accepted_guest_count ?? 0))
      : null;

  const hostFirstName = hostProfile?.display_name?.trim().split(/\s+/)[0] || 'Host';

  const { cardRef, sharePlan, copyLink, shareToWhatsApp } = usePlanShare({
    planId: plan.id,
    planTitle: plan.title,
    meetTypeName,
    city,
    currentUserId,
  });

  return (
    <>
      <Pressable
        onPress={() => {
          if (participationClosed) {
            onExpiredShare?.();
            return;
          }
          setShowShareOptions(true);
        }}
        style={({ pressed }) => [
          styles.shareButton,
          participationClosed && styles.shareButtonDisabled,
          pressed && !participationClosed && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Share this plan"
      >
        <Ionicons name="share-outline" size={18} color={colors.primary} />
        <Text style={styles.shareButtonLabel}>Share</Text>
      </Pressable>

      <ViewShot
        ref={cardRef}
        options={{ format: 'png', quality: 1 }}
        style={styles.offScreenCard}
      >
        <ShareCard
          meetTypeName={meetTypeName}
          meetTypeImageUrl={meetType?.meet_type_images}
          planTitle={plan.title}
          city={city}
          meetDate={meetDate}
          priceDisplay={priceDisplay}
          slotsLeft={slotsLeft}
          hostFirstName={hostFirstName}
          hostVerified={!!hostProfile?.verified_badge}
        />
      </ViewShot>

      <Modal
        visible={showShareOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareOptions(false)}
      >
        <Pressable style={styles.shareOverlay} onPress={() => setShowShareOptions(false)}>
          <Pressable
            style={[styles.shareSheet, { paddingBottom: spacing.lg + insets.bottom }]}
            onPress={() => {}}
          >
            <View style={styles.shareHandle} />
            <Text style={styles.shareSheetTitle}>Share this plan</Text>

            <Pressable
              style={styles.whatsappButton}
              onPress={async () => {
                setShowShareOptions(false);
                await shareToWhatsApp();
              }}
            >
              <Text style={styles.whatsappButtonLabel}>Share on WhatsApp</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryShareButton}
              onPress={async () => {
                const success = await copyLink();
                if (success) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              <Ionicons name="link-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryShareLabel}>{copied ? 'Copied!' : 'Copy link'}</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryShareButton}
              onPress={async () => {
                setShowShareOptions(false);
                await sharePlan();
              }}
            >
              <Ionicons name="share-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryShareLabel}>More options</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  shareButtonDisabled: {
    opacity: 0.52,
    borderColor: colors.border,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  shareButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  offScreenCard: {
    position: 'absolute',
    top: -2000,
    left: 0,
    opacity: 0,
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  shareSheet: {
    backgroundColor: colors.splashBackground,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  shareHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(94, 82, 255,0.25)',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  shareSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  whatsappButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  secondaryShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.22)',
    backgroundColor: colors.surface,
    paddingVertical: 14,
  },
  secondaryShareLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
});
