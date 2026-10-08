/**
 * Sent / Received tabs for MatchMaker interest queue (Offers-style, MM palette).
 */
import { MM, MM_CTA_GRADIENT, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type MatchMakerInterestSegment = 'sent' | 'received';

type Props = {
  value: MatchMakerInterestSegment;
  onChange: (value: MatchMakerInterestSegment) => void;
  sentCount?: number;
  receivedCount?: number;
};

export function MatchMakerInterestsSegmentedControl({
  value,
  onChange,
  sentCount,
  receivedCount,
}: Props) {
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
            colors={[MM.primary, '#8B7CFF']}
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
            colors={[MM.accent, '#C44B7A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.segmentFill}
          />
        ) : null}
        <Text
          style={[styles.label, value === 'received' && styles.labelOnGradient]}
          numberOfLines={1}
        >
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
    backgroundColor: 'rgba(155, 27, 75, 0.08)',
    borderRadius: radius.button,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(155, 27, 75, 0.16)',
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
    fontFamily: fonts.medium,
    fontWeight: '700',
    color: MM.muted,
    zIndex: 1,
  },
  labelOnGradient: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
