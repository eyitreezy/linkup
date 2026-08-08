import { colors, spacing, radius, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TravelModeBannerProps {
  cityLabel: string;
  onTurnOff: () => void;
  isStale?: boolean;
}

export function TravelModeBanner({ cityLabel, onTurnOff, isStale }: TravelModeBannerProps) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(94,82,255,0.12)', 'rgba(255,74,114,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.row}>
          <View style={styles.left}>
            <Ionicons name="airplane" size={15} color={colors.primary} />
            <View style={styles.textCol}>
              <Text style={styles.label} numberOfLines={1}>
                Browsing {cityLabel}
              </Text>
              {isStale ? (
                <Text style={styles.staleSub}>Travel pin set over a week ago</Text>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={onTurnOff}
            hitSlop={8}
            style={({ pressed }) => [styles.turnOffBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Turn off travel mode"
          >
            <Text style={styles.turnOffLabel}>Turn off</Text>
          </Pressable>
        </View>
        <Text style={styles.distanceNote}>Distances shown from {cityLabel}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.18)',
  },
  gradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  staleSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 1,
  },
  turnOffBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94,82,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.20)',
  },
  pressed: { opacity: 0.75 },
  turnOffLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  distanceNote: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 4,
    paddingHorizontal: 2,
  },
});
