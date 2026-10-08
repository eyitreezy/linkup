import { MM, fonts } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  unopenedCount: number;
  onPress: () => void;
  size?: number;
};

/** Filled heart with unopened received-interest counter (spec §2.4). */
export function MatchMakerInterestQueueIconButton({
  unopenedCount,
  onPress,
  size = 22,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={
        unopenedCount > 0
          ? `People who expressed interest, ${unopenedCount} new`
          : 'People who expressed interest'
      }
    >
      <Ionicons name="heart" size={size} color={MM.accent} />
      {unopenedCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unopenedCount > 9 ? '9+' : unopenedCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { position: 'relative', padding: 2 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: MM.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: MM.bg,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: '#fff',
    fontWeight: '800',
  },
});
