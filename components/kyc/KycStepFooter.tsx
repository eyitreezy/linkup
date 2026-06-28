/**
 * Dual-action footer — gradient primary + outline secondary (inbox-aligned).
 */
import { KycDualActionRow } from '@/components/kyc/KycDualActionRow';
import { spacing } from '@/constants/theme';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  backLabel?: string;
  continueDisabled?: boolean;
  continueBusy?: boolean;
};

export function KycStepFooter({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  backLabel = 'Back',
  continueDisabled = false,
  continueBusy = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <KycDualActionRow
        secondaryLabel={backLabel}
        onSecondary={onBack}
        primaryLabel={continueLabel}
        onPrimary={onContinue}
        primaryDisabled={continueDisabled}
        primaryBusy={continueBusy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.14)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
});
