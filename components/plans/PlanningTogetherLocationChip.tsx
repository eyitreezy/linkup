/**
 * Profile base location pill inside the “Planning together” card (`profiles.location_label`).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  /** e.g. "Host location" or "Their location" */
  prefix: string;
  location: string;
};

export function PlanningTogetherLocationChip({ prefix, location }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(108,99,255,0.22)', 'rgba(255,101,132,0.16)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ring}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.98)', 'rgba(250,247,255,0.95)', 'rgba(255,250,252,0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inner}
        >
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGrad}
            >
              <Ionicons name="location" size={14} color="#fff" />
            </LinearGradient>
          </View>
          <View style={styles.textCol}>
            <Text style={styles.prefix}>{prefix}</Text>
            <Text style={styles.location} numberOfLines={2}>
              {location}
            </Text>
          </View>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  ring: {
    borderRadius: radius.lg,
    padding: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg - 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  iconWrap: {
    flexShrink: 0,
  },
  iconGrad: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  prefix: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  location: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 19,
    letterSpacing: -0.15,
  },
});
