/**
 * Floating CTA — matches onboarding footer (glass bar + gradient pill).
 */
import { Button } from '@/components/Button';
import { spacing } from '@/constants/theme';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function CreatePlanWizardFooter({
  title = 'Continue',
  onPress,
  disabled,
  loading,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      <Button
        title={title}
        onPress={onPress}
        disabled={disabled}
        loading={loading}
        gradient
        pill
        fullWidth
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  btn: { marginTop: 0 },
});
