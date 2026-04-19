/**
 * K2 — Choose government ID type before capture (Hinge trust copy + Bumble steps + Tinder-large cards).
 */
import { KycSelectionCard, type KycIonName } from '@/components/kyc/KycSelectionCard';
import { kycColors, kycStyles } from '@/components/kyc/kycTheme';
import { radius, spacing } from '@/constants/theme';
import type { KycDocumentType } from '@/types/kyc';
import { ScrollView, StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OPTIONS: {
  id: KycDocumentType;
  icon: KycIonName;
  title: string;
  helper: string;
}[] = [
  {
    id: 'national_id',
    icon: 'id-card-outline',
    title: 'National Identity Card',
    helper: 'Government-issued photo ID for your country',
  },
  {
    id: 'passport',
    icon: 'book-outline',
    title: 'International Passport',
    helper: 'Open to the page with your photo and details',
  },
  {
    id: 'drivers_license',
    icon: 'car-outline',
    title: "Driver's License",
    helper: 'Valid license with your name and photo',
  },
  {
    id: 'voters_card',
    icon: 'shield-checkmark-outline',
    title: "Voter's Card",
    helper: 'Official voter registration with your photo',
  },
];

type Props = {
  selected: KycDocumentType | null;
  onSelect: (t: KycDocumentType) => void;
  onContinue: () => void;
  onBack: () => void;
};

export function DocumentSelectionScreen({ selected, onSelect, onContinue, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const canContinue = selected != null;

  return (
    <View style={kycStyles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>Trust &amp; safety</Text>
        <Text style={kycStyles.title}>Choose your ID type</Text>
        <Text style={styles.subtitle}>
          Select the document you&apos;d like to use for verification.
        </Text>
        <Text style={styles.subtitleSecondary}>
          We only use it to confirm you&apos;re real — reviewers never post it on your profile.
        </Text>

        {OPTIONS.map((o) => (
          <KycSelectionCard
            key={o.id}
            icon={o.icon}
            title={o.title}
            helper={o.helper}
            selected={selected === o.id}
            onPress={() => onSelect(o.id)}
            testID={`kyc-doc-${o.id}`}
          />
        ))}

        <Text style={styles.footerHint}>Make sure your document is valid and clearly visible.</Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            ...Platform.select({
              ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.08,
                shadowRadius: 16,
              },
              android: { elevation: 18 },
            }),
          },
        ]}
      >
        <View style={styles.footerRow}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.footerBtnGhost, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.footerBtnGhostText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            style={({ pressed }) => [
              styles.footerBtnPrimary,
              !canContinue && styles.footerBtnPrimaryDisabled,
              pressed && canContinue && { opacity: 0.92 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={[styles.footerBtnPrimaryText, !canContinue && styles.footerBtnPrimaryTextDisabled]}>
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: 0 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: kycColors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: kycColors.text,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  subtitleSecondary: {
    fontSize: 16,
    color: kycColors.muted,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  footerHint: {
    fontSize: 14,
    color: kycColors.muted,
    lineHeight: 20,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  footerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  footerBtnGhost: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: kycColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  footerBtnGhostText: { fontSize: 16, fontWeight: '700', color: kycColors.primary },
  footerBtnPrimary: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: kycColors.primary,
  },
  footerBtnPrimaryDisabled: { backgroundColor: '#E5E7EB' },
  footerBtnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  footerBtnPrimaryTextDisabled: { color: '#9CA3AF' },
});
