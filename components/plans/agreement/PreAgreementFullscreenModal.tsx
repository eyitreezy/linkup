/**
 * Bumble-style fullscreen legal gate before escrow / activation — no swipe-to-dismiss.
 */
import { Button } from '@/components/Button';
import { CancellationMatrixPolicy } from '@/components/plans/CancellationMatrixPolicy';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { formatEscrowMoney } from '@/lib/escrow/escrowPaymentPreview';
import type { CancellationMatrixPlanType } from '@/lib/plans/cancellationMatrixDisplay';
import {
  budgetFromGrossAmountCents,
  feeFromGrossAmountCents,
} from '@/lib/plans/planFinancialConfig';
import type { EscrowPattern } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
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
  /** Gross escrow amount for this user's payment row (kobo). */
  escrowAmountCents: number | null;
  currencyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  /** Fired when user taps confirm before checking the terms checkbox. */
  onTermsRequired?: () => void;
  planType?: CancellationMatrixPlanType;
  escrowPattern?: EscrowPattern | null;
};

export function PreAgreementFullscreenModal({
  visible,
  planTitle,
  whenLabel,
  locationLabel,
  priceLabel,
  escrowAmountCents,
  currencyLabel,
  busy,
  onConfirm,
  onTermsRequired,
  planType = 'standard',
  escrowPattern = 'A',
}: PreAgreementModalProps) {
  const insets = useSafeAreaInsets();
  const [read, setRead] = useState(false);

  useEffect(() => {
    if (!visible) setRead(false);
  }, [visible]);

  const grossCents =
    escrowAmountCents != null && escrowAmountCents > 0 ? escrowAmountCents : 0;
  const budgetCents = grossCents > 0 ? budgetFromGrossAmountCents(grossCents) : 0;
  const feeCents = grossCents > 0 ? feeFromGrossAmountCents(grossCents) : 0;
  const fmt = (cents: number) => formatEscrowMoney(cents, currencyLabel);

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
            Both people confirm this summary before money moves. Outcomes are structured, transparent, and enforced on our servers.
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
                <Text style={styles.line}>Plan contribution · {fmt(budgetCents)}</Text>
                <Text style={styles.muted}>
                  Funds are protected with escrow and released per plan rules after the meetup.
                </Text>
                {grossCents > 0 ? (
                  <View style={styles.nextPayCallout}>
                    <Text style={styles.nextPayTitle}>After you confirm</Text>
                    <Text style={styles.nextPayBody}>
                      {`The next screen opens secure payment via Flutterwave. You'll pay ${fmt(grossCents)} (${fmt(budgetCents)} plan contribution + ${fmt(feeCents)} platform fee). Nothing is charged on this review screen.`}
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
                <Row k="Plan contribution" v={fmt(budgetCents)} />
                <Row
                  k="Platform fee (5%, shared by all)"
                  v={`+ ${fmt(feeCents)}`}
                  valueStyle={styles.feeVAdditive}
                />
                <View style={styles.feeDivider} />
                <Row
                  k="Total escrow"
                  v={fmt(grossCents)}
                  labelStyle={styles.feeKBold}
                  valueStyle={styles.feeVBold}
                />
                <Row k="Host receives after meetup" v={fmt(budgetCents)} />
                <Text style={styles.mutedSmall}>
                  The 5% platform fee is added to the plan budget and shared by all
                  participants. Each person pays their budget share plus their
                  proportional fee contribution.
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>No platform fee on free plans.</Text>
            )}
          </Section>

          <Section title="Cancellation policy" icon="shield-checkmark-outline">
            <Text style={[styles.muted, styles.policyIntro]}>
              Role- and timing-based rules, calculated from meetup time vs when someone cancels in-app.
            </Text>
            <CancellationMatrixPolicy
              planType={planType}
              escrowPattern={escrowPattern}
              dense
            />
            <View style={styles.policyCallout}>
              <Ionicons name="server-outline" size={16} color={colors.primary} />
              <Text style={styles.policyCalloutTxt}>
                Outcomes are enforced on LinkUp servers after escrow funding and are not editable in chat.
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
            {read ? (
              <LinearGradient
                colors={[...APP_CTA_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkboxChecked}
              >
                <Ionicons name="checkmark" size={15} color="#FFFFFF" />
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={[...APP_CTA_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkboxRing}
              >
                <View style={styles.checkboxInner} />
              </LinearGradient>
            )}
            <Text style={styles.checkLabel}>I have read this summary and agree to the plan and policy.</Text>
          </Pressable>
          <Button
            title="Confirm and continue"
            onPress={() => {
              if (!read) {
                onTermsRequired?.();
                return;
              }
              onConfirm();
            }}
            loading={busy}
            disabled={busy}
            gradient
            pill
            fullWidth
            style={styles.ctaBtn}
          />
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

function Row({
  k,
  v,
  labelStyle,
  valueStyle,
}: {
  k: string;
  v: string;
  labelStyle?: object;
  valueStyle?: object;
}) {
  return (
    <View style={styles.feeRow}>
      <Text style={[styles.feeK, labelStyle]}>{k}</Text>
      <Text style={[styles.feeV, valueStyle]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text, marginTop: spacing.sm },
  headerSub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 8, fontFamily: fonts.regular, },
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
  sectionTitle: { fontSize: 15, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text },
  bold: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: fonts.bold, },
  line: { fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 20, fontFamily: fonts.regular, },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 18, fontFamily: fonts.regular, },
  mutedSmall: { fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 17, fontFamily: fonts.regular, },
  nextPayCallout: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.22)',
  },
  nextPayTitle: { fontSize: 14, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.primary, marginBottom: 6 },
  nextPayBody: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19, fontFamily: fonts.medium, },
  policyIntro: { marginBottom: spacing.sm },
  policyCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.22)',
  },
  policyCalloutTxt: { flex: 1, fontSize: 12, fontWeight: '600',
    fontFamily: fonts.medium, color: colors.textMuted, lineHeight: 17 },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  feeK: { flex: 1, fontSize: 13, color: colors.textMuted, fontFamily: fonts.regular, },
  feeV: { fontSize: 13, fontWeight: '800',
    fontFamily: fonts.bold, color: colors.text },
  feeVAdditive: { color: colors.success },
  feeKBold: { fontWeight: '800', fontFamily: fonts.bold, color: colors.text },
  feeVBold: { fontWeight: '900', fontFamily: fonts.bold },
  feeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: spacing.md },
  checkboxRing: {
    width: 24,
    height: 24,
    borderRadius: 7,
    padding: 1.5,
    marginTop: 1,
  },
  checkboxInner: {
    flex: 1,
    borderRadius: 5.5,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  checkLabel: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '600', fontFamily: fonts.medium },
  ctaBtn: {
    marginBottom: spacing.sm,
  },
});
