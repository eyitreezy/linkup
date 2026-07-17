import { FundingPatternCard } from '@/components/plans/create/FundingPatternCard';
import { spacing } from '@/constants/theme';
import type { EscrowPattern } from '@/types/database';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IonName = ComponentProps<typeof import('@expo/vector-icons').Ionicons>['name'];

type PaymentMethod = 'card' | 'bank_transfer';

type Option = {
  method: PaymentMethod;
  icon: IonName;
  title: string;
  description: string;
};

interface PaymentMethodSelectorProps {
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
}

const OPTIONS: Option[] = [
  {
    method: 'card',
    icon: 'card-outline',
    title: 'Pay by card',
    description: 'Instant confirmation. Refunds in 5-10 business days.',
  },
  {
    method: 'bank_transfer',
    icon: 'swap-horizontal-outline',
    title: 'Pay by bank transfer',
    description: 'Transfer to a dedicated account. Refunds in 3 business days.',
  },
];

export function PaymentMethodSelector({ selected, onSelect }: PaymentMethodSelectorProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Payment method</Text>
      <View style={styles.list}>
        {OPTIONS.map((opt) => (
          <FundingPatternCard
            key={opt.method}
            title={opt.title}
            description={opt.description}
            icon={opt.icon}
            selected={selected === opt.method}
            onPress={() => onSelect(opt.method)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
  list: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});

