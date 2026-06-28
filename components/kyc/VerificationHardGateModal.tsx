import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import type { UserVerification } from '@/types/database';
import { Href, router } from 'expo-router';
import { useEffect, useMemo } from 'react';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Fallback if auth profile not loaded yet — prefer fresh `dbUser` from context when open. */
  verificationStatus?: UserVerification | null;
  /** Override default title when status is `unverified` (or unknown). Ignored for pending/rejected. */
  title?: string;
  /** Extra context when unverified; compulsory “why” is always appended. Ignored for pending/rejected. */
  message?: string;
};

const DEFAULT_TITLE = 'Verification required to continue';

const WHY_COMPULSORY =
  'Why this matters: LinkUp only allows creating plans, sending offers, and using escrow after we confirm who you are. That protects everyone at real world meetups and when money changes hands.';

const DEFAULT_INTRO =
  'To keep meetups and payments safe for everyone, LinkUp needs to confirm your identity before you create plans, negotiate offers, or use secure escrow.';

function normalizeVerification(
  s: UserVerification | string | null | undefined
): UserVerification | null {
  if (s == null) return null;
  if (s === 'unverified' || s === 'pending' || s === 'verified' || s === 'rejected') return s;
  const lower = String(s).toLowerCase();
  if (lower === 'pending') return 'pending';
  if (lower === 'verified') return 'verified';
  if (lower === 'rejected') return 'rejected';
  if (lower === 'unverified') return 'unverified';
  return null;
}

/**
 * Blocking prompt when user attempts plan create, negotiation, or escrow without verification.
 * Refreshes the user row when opened so `pending` shows review copy instead of “Start verification”.
 */
export function VerificationHardGateModal({
  visible,
  onClose,
  verificationStatus: verificationStatusProp,
  title,
  message,
}: Props) {
  const { dbUser, refreshProfile } = useAuth();

  useEffect(() => {
    if (!visible) return;
    void refreshProfile();
    // Only when the gate opens — `refreshProfile` is not stable on the context value.
  }, [visible]);

  const effectiveStatus = useMemo(
    () => normalizeVerification(dbUser?.verification_status ?? verificationStatusProp),
    [dbUser?.verification_status, verificationStatusProp]
  );

  const { modalTitle, body, primaryLabel } = useMemo(() => {
    if (effectiveStatus === 'pending') {
      return {
        modalTitle: 'Your verification is in review',
        body:
          "Good news. We've received your documents and our team is reviewing them. Most decisions come back within a few hours; sometimes it takes a bit longer.\n\n" +
          "You'll still need an approved verification before you can create plans, negotiate, or use escrow. We can't unlock those steps until your review is complete.\n\n" +
          WHY_COMPULSORY +
          '\n\nTap below to open the verification hub, check your place in the flow, or add anything we request.',
        primaryLabel: 'View status',
      };
    }
    if (effectiveStatus === 'rejected') {
      return {
        modalTitle: 'Verification needs another look',
        body:
          "We weren't able to approve your last submission, often due to glare or unreadable photos. You can try again with clearer images.\n\n" +
          WHY_COMPULSORY,
        primaryLabel: 'Resume verification',
      };
    }
    const intro = message?.trim() ? message.trim() : DEFAULT_INTRO;
    return {
      modalTitle: title ?? DEFAULT_TITLE,
      body: `${intro}\n\n${WHY_COMPULSORY}`,
      primaryLabel: 'Start verification',
    };
  }, [effectiveStatus, title, message]);

  function goToKyc() {
    onClose();
    router.push('/kyc' as Href);
  }

  return (
    <AppConfirmModal
      visible={visible}
      onClose={onClose}
      kicker="Verification"
      title={modalTitle}
      message={body}
      primaryLabel={primaryLabel}
      onPrimary={goToKyc}
      secondaryLabel="Not now"
      iconVariant="verification"
      actionsLayout="stack"
      stackPrimaryFirst
    />
  );
}
