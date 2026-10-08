import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { subscriptionLapseDaysRemaining } from '@/lib/matchmaker/lifecycle';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  pausedAt: string | null;
};

export function MatchMakerSubscriptionLapseBanner({ pausedAt }: Props) {
  const daysLeft = subscriptionLapseDaysRemaining(pausedAt);
  if (daysLeft == null) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Your subscription has lapsed.</Text>
      <Text style={styles.body}>
        Resolve your account to continue this connection. You have {daysLeft} day
        {daysLeft === 1 ? '' : 's'} before it closes automatically.
      </Text>
      <Pressable onPress={() => router.push('/subscription' as Href)} style={styles.cta}>
        <Text style={styles.ctaText}>Restore subscription</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.bold, color: '#92400E', fontSize: 14 },
  body: { marginTop: 4, fontFamily: fonts.regular, color: '#92400E', lineHeight: 18, fontSize: 13 },
  cta: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  ctaText: { fontFamily: fonts.bold, color: MM.accent, fontSize: 13 },
});
