/**
 * Sent / Received filter — pill segmented control with gradient active state.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
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
        style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'sent' }}
      >
        {value === 'sent' ? (
          <LinearGradient
            colors={[colors.primary, '#8B7CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.segmentFill}
          />
        ) : null}
        <Text style={[styles.label, value === 'sent' && styles.labelOnGradient]} numberOfLines={1}>
          Sent{typeof sentCount === 'number' ? ` (${sentCount})` : ''}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('received')}
        style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'received' }}
      >
        {value === 'received' ? (
          <LinearGradient
            colors={[colors.secondary, '#FF9AAC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.segmentFill}
          />
        ) : null}
        <Text style={[styles.label, value === 'received' && styles.labelOnGradient]} numberOfLines={1}>
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
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderRadius: radius.button,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    overflow: 'hidden',
    position: 'relative',
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.button,
  },
  segmentPressed: { opacity: 0.92 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    zIndex: 1,
  },
  labelOnGradient: {
    color: '#fff',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
