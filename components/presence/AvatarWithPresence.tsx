/**
 * Avatar + optional presence dot (Tinder-style minimal).
 */
import { Avatar } from '@/components/Avatar';
import { colors } from '@/constants/theme';
import type { PresenceUi } from '@/lib/presence/derivePresenceUi';
import { StyleSheet, View } from 'react-native';

type Props = {
  uri: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  presence: PresenceUi | null;
  /** When false, skip dot entirely (e.g. no relationship / RLS). */
  showDot?: boolean;
};

export function AvatarWithPresence({ uri, name, size = 48, presence, showDot = true }: Props) {
  const dot = showDot && presence?.dot;
  const dotColor =
    dot === 'online'
      ? colors.success
      : dot === 'recent'
        ? colors.textMuted
        : dot === 'offline'
          ? '#94A3B8'
          : 'transparent';
  const ring =
    dot === 'online'
      ? 'rgba(16, 185, 129, 0.35)'
      : dot === 'recent'
        ? 'rgba(107, 114, 128, 0.35)'
        : dot === 'offline'
          ? 'rgba(148, 163, 184, 0.4)'
          : 'transparent';

  return (
    <View style={styles.wrap}>
      <Avatar uri={uri} name={name} size={size} />
      {dot ? (
        <View
          style={[
            styles.dotRing,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              borderColor: ring,
              bottom: size * 0.02,
              right: size * 0.02,
            },
          ]}
          accessibilityLabel={presence?.caption ?? 'Presence'}
        >
          <View style={[styles.dot, { backgroundColor: dotColor, width: size * 0.16, height: size * 0.16, borderRadius: size * 0.08 }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  dotRing: {
    position: 'absolute',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dot: {},
});
