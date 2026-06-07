import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onUpgrade: () => void;
  isSubscriber: boolean;
  premiumUntilLabel?: string | null;
};

export function PremiumCard({ onUpgrade, isSubscriber, premiumUntilLabel }: Props) {
  if (isSubscriber) {
    const renewLine = premiumUntilLabel ? `Renews · ${premiumUntilLabel}` : 'Membership active';

    return (
      <Pressable
        onPress={onUpgrade}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Manage Premium membership"
      >
        <LinearGradient
          colors={[colors.primary, '#8B7CE8', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.activeInner}>
            <View style={styles.iconCircle}>
              <Ionicons name="diamond" size={22} color={colors.primary} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.activeTitle}>You&apos;re Premium</Text>
              <Text style={styles.activeSub}>{renewLine}</Text>
            </View>
            <View style={styles.manageChip}>
              <Text style={styles.manage}>Manage</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onUpgrade}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Upgrade to Premium"
    >
      <LinearGradient
        colors={[colors.primary, '#8B7CE8', colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.inner}>
          <View style={styles.upgradeIconRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
            </View>
            <Text style={styles.upgradeKicker}>LinkUp Premium</Text>
          </View>
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
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  gradient: { borderRadius: radius.xl },
  inner: { padding: spacing.lg },
  activeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  upgradeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  upgradeKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 6, letterSpacing: -0.3 },
  sub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.92)', lineHeight: 20, marginBottom: spacing.md },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cta: { fontSize: 17, fontWeight: '800', color: '#fff' },
  activeTitle: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  activeSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  manageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  manage: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
