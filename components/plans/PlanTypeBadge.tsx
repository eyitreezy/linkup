import { colors, fonts, radius } from '@/constants/theme';
import type { PlanTypeBadgeSpec } from '@/lib/plans/planTypeIndicators';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

type Props = {
  badge: PlanTypeBadgeSpec;
  variant?: 'swipe' | 'list';
  style?: ViewStyle;
};

export function PlanTypeBadge({ badge, variant = 'list', style }: Props) {
  if (badge.tone === 'group') {
    return (
      <View style={[variant === 'swipe' ? styles.swipeGroup : styles.listGroup, style]}>
        <Text style={variant === 'swipe' ? styles.swipeGroupTxt : styles.listGroupTxt}>
          {badge.label}
        </Text>
      </View>
    );
  }

  if (badge.tone === 'mood_urgency') {
    return (
      <LinearGradient
        colors={[colors.secondary, '#ff8ba0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[variant === 'swipe' ? styles.swipeMoodUrgent : styles.listMoodUrgent, style]}
      >
        <Text style={variant === 'swipe' ? styles.swipeMoodUrgentTxt : styles.listMoodUrgentTxt}>
          {badge.label}
        </Text>
      </LinearGradient>
    );
  }

  if (badge.tone === 'mood') {
    return (
      <View style={[variant === 'swipe' ? styles.swipeMeta : styles.listMeta, style]}>
        <Text
          style={variant === 'swipe' ? styles.swipeMetaTxt : styles.listMetaTxt}
          numberOfLines={1}
        >
          {badge.label}
        </Text>
      </View>
    );
  }

  return (
    <View style={[variant === 'swipe' ? styles.swipeMeta : styles.listMeta, style]}>
      <Text style={variant === 'swipe' ? styles.swipeMetaTxt : styles.listMetaTxt} numberOfLines={1}>
        {badge.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeGroup: {
    backgroundColor: 'rgba(94, 82, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  swipeGroupTxt: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: 0.6,
  },
  listGroup: {
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.28)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  listGroupTxt: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  swipeMoodUrgent: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  swipeMoodUrgentTxt: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  listMoodUrgent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  listMoodUrgentTxt: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  swipeMeta: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    maxWidth: 140,
  },
  swipeMetaTxt: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  listMeta: {
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    maxWidth: 120,
  },
  listMetaTxt: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
});
