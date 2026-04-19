import { Button } from '@/components/Button';
import { kycColors, kycShadow, kycStyles } from '@/components/kyc/kycTheme';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import type { UserVerification } from '@/types/database';
import { Href, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  'Why this matters: LinkUp only allows creating plans, sending offers, and using escrow after we confirm who you are. That protects everyone at real-world meetups and when money changes hands.';

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
          "Good news — we've received your documents and our team is reviewing them. Most decisions come back within a few hours; sometimes it takes a bit longer.\n\n" +
          "You'll still need an approved verification before you can create plans, negotiate, or use escrow — we can't unlock those steps until your review is complete.\n\n" +
          WHY_COMPULSORY +
          '\n\nTap below to open the verification hub, check your place in the flow, or add anything we request.',
        primaryLabel: 'Resume / view status',
      };
    }
    if (effectiveStatus === 'rejected') {
      return {
        modalTitle: 'Verification needs another look',
        body:
          "We weren't able to approve your last submission — often due to glare or unreadable photos. You can try again with clearer images.\n\n" +
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
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[kycStyles.card, styles.card]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{modalTitle}</Text>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <Button title={primaryLabel} onPress={goToKyc} pill />
            <Button title="Not now" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    ...kycShadow,
    maxHeight: '88%',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: kycColors.text,
    marginBottom: spacing.md,
  },
  bodyScroll: {
    maxHeight: 320,
    marginBottom: spacing.lg,
  },
  bodyScrollContent: {
    flexGrow: 1,
  },
  body: {
    fontSize: 15,
    color: kycColors.muted,
    lineHeight: 22,
  },
  actions: {
    marginTop: 'auto',
  },
});
