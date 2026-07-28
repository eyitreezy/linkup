import { Screen } from '@/components/Screen';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function ExigencySuccessScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenTransparent}>
      <AppShellBackground />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
        </View>
        <Text style={styles.title}>Report received</Text>
        <Text style={styles.body}>
          Your Exigency Report has been received. We will notify you of the outcome within 48 hours
          (or 72 hours for emergency claims). You can track updates in your wallet.
        </Text>
        <Pressable style={styles.buttonOuter} onPress={() => router.replace('/wallet')}>
          <LinearGradient
            colors={[colors.primary, '#8B7CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonLabel}>Go to wallet</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => router.replace(`/plan/${planId}`)}>
          <Text style={styles.link}>Back to plan</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTransparent: { backgroundColor: 'transparent', flex: 1 },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  buttonOuter: { width: '100%', borderRadius: 50, overflow: 'hidden', marginTop: spacing.sm },
  buttonGradient: { paddingVertical: spacing.md, alignItems: 'center' },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  link: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
    marginTop: spacing.sm,
  },
});
