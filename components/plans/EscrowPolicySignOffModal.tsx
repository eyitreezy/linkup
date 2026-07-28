/**
 * POLICY DELIVERY MOMENTS - GROUP PLANS (ANNEXURE B)
 *
 * 1. ONBOARDING (existing)
 *    Terms of Use - nature of platform, eligibility, escrow, contact policy
 *    Privacy & NDPR Consent - data collection, storage, user rights
 *
 * 2. FIRST GROUP PLAN INTERACTION (GroupPlanPolicyGate)
 *    Full Group Plan rules: confirmation window, Exigency process,
 *    all 5 outcomes, 50% floor, fund storage limit, host cancellation,
 *    host no-show, platform fee. Signed once per policy version.
 *
 * 3. ESCROW INITIATION - BEFORE CHECKOUT (EscrowPolicySignOffModal)
 *    Per-pattern cancellation matrix, no-show consequences, 50% floor,
 *    platform fee. Signed once per plan per user.
 *
 * 4. FIRST MEETUP BETWEEN TWO PARTIES (SafetyCaveatInterstitial)
 *    Safety recommendation: public space for first meetup.
 *    Acknowledged once per pair.
 *
 * 5. MEETUP TIME - T+0 push notification
 * 6. T+12H POST MEETUP push notification
 * 7. T+23H POST MEETUP push notification
 * 8. DISPUTE VIDEO CAPTURE NDPR consent
 * 9. EXIGENCY EVIDENCE UPLOAD NDPR consent
 *
 * Policy text lives in lib/plans/policySignOffContent.ts
 */

import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  ESCROW_POLICY_BY_PATTERN,
  normalizeEscrowPattern,
} from '@/lib/plans/policySignOffContent';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  planId: string;
  userId: string;
  escrowPattern?: string | null;
  onSigned: () => void;
};

export function EscrowPolicySignOffModal({
  visible,
  planId,
  userId,
  escrowPattern,
  onSigned,
}: Props) {
  const [isSigning, setIsSigning] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const pattern = normalizeEscrowPattern(escrowPattern);
  const sections = ESCROW_POLICY_BY_PATTERN[pattern];

  const handleSign = async () => {
    if (!hasScrolled) return;
    setIsSigning(true);
    try {
      await supabase.from('escrow_policy_signoffs').upsert(
        { plan_id: planId, user_id: userId },
        { onConflict: 'plan_id,user_id', ignoreDuplicates: true }
      );
      onSigned();
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Escrow and Cancellation Policy</Text>
          <Text style={styles.patternLabel}>Pattern {pattern}</Text>

          <ScrollView
            style={styles.scrollArea}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const isNearBottom =
                layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
              if (isNearBottom) setHasScrolled(true);
            }}
            scrollEventThrottle={200}
          >
            {sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.heading}</Text>
                {section.paragraphs.map((p) => (
                  <Text key={p} style={styles.bodyText}>
                    {p}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>

          <Text style={styles.captionText}>
            By proceeding you confirm you have read and understood these terms.
          </Text>

          <Pressable
            style={[styles.buttonOuter, (!hasScrolled || isSigning) && styles.buttonDisabled]}
            onPress={handleSign}
            disabled={!hasScrolled || isSigning}
          >
            <LinearGradient
              colors={[colors.primary, '#8B7CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {isSigning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonLabel}>I have read and I agree</Text>
              )}
            </LinearGradient>
          </Pressable>

          {!hasScrolled ? (
            <Text style={styles.scrollPrompt}>Scroll to read before agreeing</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  patternLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  scrollArea: { maxHeight: 360 },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  bodyText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
    marginBottom: spacing.xs,
  },
  captionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  scrollPrompt: {
    fontSize: 12,
    color: colors.secondary,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: fonts.medium,
  },
  buttonOuter: { borderRadius: 50, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.5 },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
