/**
 * PL6a — explains what happens on the next screen (escrow / Flutterwave) before the user taps through.
 */
import { colors, radius, spacing } from '@/constants/theme';
import {
  formatEscrowMoney,
  patternLabel,
  type AgreementPaymentPreview,
} from '@/lib/escrow/escrowPaymentPreview';
import type { EscrowPattern } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  preview: AgreementPaymentPreview;
  /** Host waiting for guest vs payer about to continue. */
  variant: 'you_pay_next' | 'counterparty_pays' | 'split_you_pay' | 'split_waiting';
};

function bodyForVariant(preview: AgreementPaymentPreview, variant: Props['variant']): string {
  const { currency, userPaysCents, counterpartyPaysCents, totalCents, pattern } = preview;
  const yours = formatEscrowMoney(userPaysCents, currency);
  const theirs = formatEscrowMoney(counterpartyPaysCents, currency);
  const total = formatEscrowMoney(totalCents, currency);

  if (variant === 'counterparty_pays') {
    return `No charge on this screen. ${theirs} will be held in escrow on the next screen once your guest completes checkout. Total commitment: ${total}.`;
  }
  if (variant === 'split_you_pay') {
    return `On the next screen you'll pay ${yours} (your share of ${total}). ${theirs} is paid separately by your guest — both legs must complete before the plan goes active.`;
  }
  if (variant === 'split_waiting') {
    return `You've confirmed your share. We're waiting for ${theirs} from your guest on the escrow screen. Total held when complete: ${total}.`;
  }
  if (pattern === 'C') {
    return `On the next screen you'll pay ${yours} via Flutterwave. Funds stay in escrow until the meetup is confirmed.`;
  }
  return `On the next screen you'll pay ${yours} via Flutterwave. Funds stay in escrow until the meetup is confirmed — not sent directly to the other person.`;
}

export function AgreementPaymentPreviewCard({ preview, variant }: Props) {
  const amount =
    variant === 'counterparty_pays'
      ? preview.counterpartyPaysCents
      : preview.userPaysCents;
  const headline =
    variant === 'counterparty_pays'
      ? formatEscrowMoney(amount, preview.currency)
      : formatEscrowMoney(preview.userPaysCents, preview.currency);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(108,99,255,0.22)', 'rgba(255,101,132,0.12)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
      />
      <View style={styles.iconRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="wallet-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.headCol}>
          <Text style={styles.kicker}>Next screen</Text>
          <Text style={styles.title}>
            {variant === 'counterparty_pays' ? `Guest pays ${headline}` : `You'll pay ${headline}`}
          </Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        <PatternChip pattern={preview.pattern} />
        <Text style={styles.chipMuted}>· Flutterwave · held in escrow</Text>
      </View>
      <Text style={styles.body}>{bodyForVariant(preview, variant)}</Text>
    </View>
  );
}

function PatternChip({ pattern }: { pattern: EscrowPattern }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipTxt}>{patternLabel(pattern)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCol: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  chipTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  chipMuted: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  body: { fontSize: 14, fontWeight: '600', color: colors.textMuted, lineHeight: 21 },
});
