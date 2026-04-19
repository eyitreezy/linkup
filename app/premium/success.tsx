/**
 * PR3 — Premium success.
 */
import { Button } from '@/components/Button';
import { colors, spacing } from '@/constants/theme';
import { Href, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PremiumSuccessScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emoji} accessibilityLabel="Celebration">
          {'\u{1F389}'}
        </Text>
        <Text style={styles.title}>You&apos;re now Premium</Text>
        <Text style={styles.body}>
          You can boost plans, use advanced filters, travel mode, see who&apos;s interested, and undo feed hides.
        </Text>
        <Button title="Start boosting your plans" onPress={() => router.replace('/(tabs)' as Href)} />
        <Button
          title="Done"
          variant="ghost"
          onPress={() => router.replace('/(tabs)/profile' as Href)}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  body: { fontSize: 16, color: colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: spacing.xl },
});
