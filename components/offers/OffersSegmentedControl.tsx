/**
 * Sent / Received filter — pill segmented control (Bumble-style).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type OffersSegment = 'sent' | 'received';

type Props = {
  value: OffersSegment;
  onChange: (v: OffersSegment) => void;
  sentCount?: number;
  receivedCount?: number;
};

export function OffersSegmentedControl({ value, onChange, sentCount, receivedCount }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange('sent')}
        style={({ pressed }) => [
          styles.segment,
          value === 'sent' && styles.segmentActive,
          pressed && styles.segmentPressed,
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'sent' }}
      >
        <Text style={[styles.label, value === 'sent' && styles.labelActive]} numberOfLines={1}>
          Sent{typeof sentCount === 'number' ? ` (${sentCount})` : ''}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('received')}
        style={({ pressed }) => [
          styles.segment,
          value === 'received' && styles.segmentActive,
          pressed && styles.segmentPressed,
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'received' }}
      >
        <Text style={[styles.label, value === 'received' && styles.labelActive]} numberOfLines={1}>
          Received{typeof receivedCount === 'number' ? ` (${receivedCount})` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderRadius: radius.button,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.button,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#1A1D26',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentPressed: { opacity: 0.92 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
