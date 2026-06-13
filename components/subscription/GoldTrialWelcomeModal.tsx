import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onContinue: () => void;
};

const GOLD_GRADIENT = ['#F5D76E', '#D4A017'] as const;

export function GoldTrialWelcomeModal({ visible, onContinue }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onContinue}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient colors={[...GOLD_GRADIENT]} style={styles.iconWrap}>
            <Ionicons name="sparkles" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.title}>Welcome to your Gold trial!</Text>
          <Text style={styles.body}>
            Enjoy 7 days of Gold features — extended mood plans, group plans, 72h boosts, and more.
          </Text>
          <Pressable onPress={onContinue} style={styles.btn}>
            <LinearGradient colors={[...GOLD_GRADIENT]} style={styles.btnGrad}>
              <Text style={styles.btnTxt}>Explore Gold features</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  btn: { alignSelf: 'stretch', borderRadius: radius.button, overflow: 'hidden' },
  btnGrad: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
