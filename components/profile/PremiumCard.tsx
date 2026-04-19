import { radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onUpgrade: () => void;
  isSubscriber: boolean;
  premiumUntilLabel?: string | null;
};

export function PremiumCard({ onUpgrade, isSubscriber, premiumUntilLabel }: Props) {
  if (isSubscriber && premiumUntilLabel) {
    return (
      <View style={styles.activeWrap}>
        <LinearGradient colors={['#6C63FF', '#FF6584']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <View style={styles.activeInner}>
            <Ionicons name="sparkles" size={22} color="#fff" />
            <View style={styles.textCol}>
              <Text style={styles.activeTitle}>You&apos;re Premium</Text>
              <Text style={styles.activeSub}>Renews · {premiumUntilLabel}</Text>
            </View>
            <Pressable onPress={onUpgrade} hitSlop={8} accessibilityRole="button" accessibilityLabel="Manage premium">
              <Text style={styles.manage}>Manage</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <Pressable onPress={onUpgrade} style={styles.wrap} accessibilityRole="button" accessibilityLabel="Upgrade to Premium">
      <LinearGradient colors={['#6C63FF', '#FF6584']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.inner}>
          <Text style={styles.title}>Get more visibility on LinkUp</Text>
          <Text style={styles.sub}>Boost your plans, see interest, and stand out</Text>
          <View style={styles.ctaRow}>
            <Text style={styles.cta}>Upgrade</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.md, marginBottom: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  activeWrap: { marginHorizontal: spacing.md, marginBottom: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  gradient: { borderRadius: radius.xl },
  inner: { padding: spacing.lg },
  activeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  textCol: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.92)', lineHeight: 20, marginBottom: spacing.md },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cta: { fontSize: 17, fontWeight: '800', color: '#fff' },
  activeTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  activeSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  manage: { fontSize: 15, fontWeight: '800', color: '#fff', textDecorationLine: 'underline' },
});
