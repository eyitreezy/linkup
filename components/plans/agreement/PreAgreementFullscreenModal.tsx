/**
 * Bumble-style fullscreen legal gate before escrow / activation — no swipe-to-dismiss.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { CancellationPolicyRowGroups } from '@/components/plans/CancellationPolicyRows';
import { AGREEMENT_CANCELLATION_POLICY_GROUPS } from '@/lib/plans/cancellationPolicy';
import { platformFeeCentsForAmount } from '@/lib/plans/planFinancialConfig';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type PreAgreementModalProps = {
  visible: boolean;
  planTitle: string;
  whenLabel: string;
  locationLabel: string | null;
  priceLabel: string;
  escrowAmountCents: number | null;
  /** Amount this user pays on the next screen (split = share only). */
  userPaysCents?: number | null;
  currencyLabel: string;
  busy: boolean;
  onConfirm: () => void;
};

export function PreAgreementFullscreenModal({
  visible,
  planTitle,
  whenLabel,
  locationLabel,
  priceLabel,
  escrowAmountCents,
  userPaysCents,
  currencyLabel,
  busy,
  onConfirm,
}: PreAgreementModalProps) {
  const insets = useSafeAreaInsets();
  const [read, setRead] = useState(false);

  useEffect(() => {
    if (!visible) setRead(false);
  }, [visible]);

  const fee =
    escrowAmountCents != null && escrowAmountCents > 0
      ? platformFeeCentsForAmount(escrowAmountCents)
      : 0;
  const payeeApprox =
    escrowAmountCents != null && escrowAmountCents > 0
      ? Math.max(escrowAmountCents - fee, 0)
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        /* Non-dismissible — user must confirm or use system UI; avoids accidental exits. */
      }}
    >
      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Ionicons name="document-text-outline" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>Review & confirm</Text>
          <Text style={styles.headerSub}>
            Both people confirm this summary before money moves — structured, transparent, enforced on our servers.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Section title="Plan summary" icon="calendar-outline">
            <Text style={styles.bold}>{planTitle}</Text>
            <Text style={styles.line}>{whenLabel}</Text>
            {locationLabel ? <Text style={styles.line}>{locationLabel}</Text> : null}
            <Text style={styles.line}>Agreed price · {priceLabel}</Text>
          </Section>

          <Section title="Escrow" icon="lock-closed-outline">
            {escrowAmountCents != null && escrowAmountCents > 0 ? (
              <>
                <Text style={styles.line}>
                  Held amount · {currencyLabel} {(escrowAmountCents / 100).toLocaleString()}
                </Text>
                <Text style={styles.muted}>
                  Funds are protected with escrow and released per plan rules after the meetup.
                </Text>
                {(userPaysCents ?? escrowAmountCents) > 0 ? (
                  <View style={styles.nextPayCallout}>
                    <Text style={styles.nextPayTitle}>After you confirm</Text>
                    <Text style={styles.nextPayBody}>
                      The next screen opens secure payment — you&apos;ll pay{' '}
                      {currencyLabel === 'NGN' ? '₦' : `${currencyLabel} `}
                      {((userPaysCents ?? escrowAmountCents) / 100).toLocaleString()} via Flutterwave. Nothing is
                      charged on this review screen.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.line}>No escrow for this free plan.</Text>
            )}
          </Section>

          <Section title="Fees (estimate)" icon="pricetag-outline">
            {escrowAmountCents != null && escrowAmountCents > 0 ? (
              <>
                <Row k="Platform fee (at release, est.)" v={`${currencyLabel} ${(fee / 100).toLocaleString()}`} />
                <Row
                  k="Approx. to host after fee"
                  v={`${currencyLabel} ${((payeeApprox ?? 0) / 100).toLocaleString()}`}
                />
                <Text style={styles.mutedSmall}>
                  Exact fee tier depends on amount; shown here from the in-app calculator.
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>No platform fee on free plans.</Text>
            )}
          </Section>

          <Section title="Cancellation policy" icon="shield-checkmark-outline">
            <Text style={[styles.muted, styles.policyIntro]}>
              Role- and timing-based rules — calculated from meetup time vs when someone cancels in-app.
            </Text>
            <CancellationPolicyRowGroups groups={AGREEMENT_CANCELLATION_POLICY_GROUPS} dense />
            <View style={styles.policyCallout}>
              <Ionicons name="server-outline" size={16} color={colors.primary} />
              <Text style={styles.policyCalloutTxt}>
                Outcomes are enforced on LinkUp servers after escrow funding — not editable in chat.
              </Text>
            </View>
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => setRead((x) => !x)}
            style={styles.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: read }}
          >
            <View style={[styles.box, read && styles.boxOn]}>{read ? <Text style={styles.tick}>✓</Text> : null}</View>
            <Text style={styles.checkLabel}>I have read this summary and agree to the plan and policy.</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!read || busy) return;
              onConfirm();
            }}
            style={({ pressed }) => [
              styles.cta,
              (!read || busy) && styles.ctaDisabled,
              pressed && read && !busy && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            disabled={!read || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaTxt}>Confirm and continue</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.feeRow}>
      <Text style={styles.feeK}>{k}</Text>
      <Text style={styles.feeV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  headerSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 8 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  bold: { fontSize: 16, fontWeight: '800', color: colors.text },
  line: { fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 18 },
  mutedSmall: { fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 17 },
  nextPayCallout: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  nextPayTitle: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 6 },
  nextPayBody: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19 },
  policyIntro: { marginBottom: spacing.sm },
  policyCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  policyCalloutTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted, lineHeight: 17 },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  feeK: { flex: 1, fontSize: 13, color: colors.textMuted },
  feeV: { fontSize: 13, fontWeight: '800', color: colors.text },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: spacing.md },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontSize: 13, fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '600' },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaPressed: { opacity: 0.92 },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
