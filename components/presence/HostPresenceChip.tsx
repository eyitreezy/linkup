/**
 * Compact online / offline label for discover cards.
 */
import { colors, radius, spacing } from '@/constants/theme';
import type { PresenceUi } from '@/lib/presence/derivePresenceUi';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  presence: PresenceUi | null;
  /** Light text for swipe hero; dark for list cards. */
  variant?: 'onDark' | 'onLight';
};

function dotColor(dot: NonNullable<PresenceUi['dot']>): string {
  if (dot === 'online') return colors.success;
  if (dot === 'recent') return colors.textMuted;
  return '#94A3B8';
}

export function HostPresenceChip({ presence, variant = 'onLight' }: Props) {
  if (!presence?.caption) return null;
  const onDark = variant === 'onDark';

  return (
    <View
      style={[styles.chip, onDark ? styles.chipOnDark : styles.chipOnLight]}
      accessibilityLabel={presence.caption}
    >
      {presence.dot ? (
        <View style={[styles.dot, { backgroundColor: dotColor(presence.dot) }]} />
      ) : null}
      <Text style={[styles.txt, onDark ? styles.txtOnDark : styles.txtOnLight]}>{presence.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  chipOnLight: {
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  chipOnDark: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  txt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  txtOnLight: { color: colors.text },
  txtOnDark: { color: '#fff' },
});
