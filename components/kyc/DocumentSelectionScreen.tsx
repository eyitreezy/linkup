/**
 * K2 — Choose government ID type before capture.
 */
import { KycLeadBlock } from '@/components/kyc/KycLeadBlock';
import { KycSectionHead } from '@/components/kyc/KycSectionHead';
import { KycSelectionCard, type KycIonName } from '@/components/kyc/KycSelectionCard';
import { KycStepFooter } from '@/components/kyc/KycStepFooter';
import { kycColors, kycInboxStyles, kycStyles } from '@/components/kyc/kycTheme';
import { spacing } from '@/constants/theme';
import type { KycDocumentType } from '@/types/kyc';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const canContinue = selected != null;

  return (
    <View style={kycStyles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={kycInboxStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <KycLeadBlock
          kicker="Document"
          title="Choose your ID type"
          subtitle="Select the document you'd like to use. We only use it to confirm you're real — reviewers never post it on your profile."
        />
        <KycSectionHead title="Accepted IDs" />
        <View style={styles.cardList}>
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
        </View>
        <Text style={styles.footerHint}>Make sure your document is valid and clearly visible.</Text>
      </ScrollView>

      <KycStepFooter
        onBack={onBack}
        onContinue={onContinue}
        continueDisabled={!canContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  cardList: { paddingHorizontal: spacing.md },
  footerHint: {
    fontSize: 14,
    color: kycColors.muted,
    lineHeight: 20,
    marginTop: spacing.xs,
    fontStyle: 'italic',
    paddingHorizontal: spacing.md,
    fontWeight: '600',
  },
});
