/**
 * Compact discover empty — search, filters, mood variants (app-standard shell).
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Ion = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: Ion;
  title: string;
  titleAccent?: string;
  subtitle: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
};

export function DiscoverInlineEmpty({ icon, title, titleAccent, subtitle, ctaLabel, onCtaPress }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(94, 82, 255,0.25)', 'rgba(255, 74, 114,0.2)']}
        style={styles.ringOuter}
      >
        <LinearGradient colors={['#fff', '#F8F4FF']} style={styles.ringInner}>
          <Ionicons name={icon} size={36} color={colors.primary} />
        </LinearGradient>
      </LinearGradient>

      <Text style={styles.title}>
        {title}
        {titleAccent ? <Text style={styles.titleAccent}> {titleAccent}</Text> : null}
      </Text>
      <Text style={styles.sub}>{subtitle}</Text>

      {ctaLabel && onCtaPress ? (
        <LinearGradient
          colors={[colors.primary, '#8B7CFF', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaShell}
        >
          <Button
            title={ctaLabel}
            onPress={onCtaPress}
            pill
            variant="primary"
            style={styles.ctaInner}
            textStyle={styles.ctaTxt}
          />
        </LinearGradient>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    width: '100%',
  },
  ringOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  ringInner: {
    width: '100%',
    height: '100%',
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  titleAccent: { color: colors.secondary },
  sub: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    maxWidth: 320,
  },
  ctaShell: {
    marginTop: spacing.xl,
    borderRadius: radius.button,
    padding: 2,
    alignSelf: 'stretch',
    maxWidth: 320,
    width: '100%',
  },
  ctaInner: { backgroundColor: '#fff', width: '100%', margin: 0 },
  ctaTxt: {
    color: colors.primary,
    fontWeight: '900',
    fontFamily: fonts.bold,
  },
});
