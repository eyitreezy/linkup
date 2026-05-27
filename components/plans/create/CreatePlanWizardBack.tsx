import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

type Props = {
  /** When the stack cannot pop, navigate here (step 1 exit). */
  fallbackHref?: Href;
};

export function CreatePlanWizardBack({ fallbackHref = '/(tabs)' as Href }: Props) {
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace(fallbackHref);
      }}
      style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="arrow-back" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: onboarding.glassBorder,
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.92 },
});
