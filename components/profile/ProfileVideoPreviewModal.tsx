/**
 * Full-screen profile video preview — onboarding + edit profile.
 */
import { KycLivenessVideoPreview } from '@/components/kyc/KycLivenessVideoPreview';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type Props = {
  visible: boolean;
  uri: string | null;
  slotIndex: number;
  slotTotal: number;
  onClose: () => void;
};

export function ProfileVideoPreviewModal({
  visible,
  uri,
  slotIndex,
  slotTotal,
  onClose,
}: Props) {
  const { height: windowH } = useWindowDimensions();
  const playerHeight = Math.min(Math.round(windowH * 0.52), 420);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close preview" />
        <View style={styles.sheetHit} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(94, 82, 255,0.55)', 'rgba(255, 74, 114,0.35)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            <View style={styles.card}>
              <View style={styles.headRow}>
                <View style={styles.headText}>
                  <Text style={styles.kicker}>Profile video</Text>
                  <Text style={styles.title}>
                    Clip {slotIndex + 1}
                    {slotTotal > 1 ? ` of ${slotTotal}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Close video preview"
                >
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
              </View>

              {uri ? (
                <View style={[styles.playerShell, { height: playerHeight }]}>
                  <KycLivenessVideoPreview uri={uri} style={styles.player} mirror={false} />
                </View>
              ) : null}

              <Text style={styles.hint}>
                Tap the player controls to play, pause, or open fullscreen.
              </Text>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.doneOuter, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Done previewing"
              >
                <LinearGradient
                  colors={[colors.primary, '#8B7CE8', colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.doneGrad}
                >
                  <Text style={styles.doneTxt}>Done</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 17, 24, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheetHit: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.28,
        shadowRadius: 28,
      },
      android: { elevation: 10 },
    }),
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headText: { flex: 1 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(94, 82, 255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: { opacity: 0.85 },
  playerShell: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255,0.18)',
  },
  player: { flex: 1, width: '100%', borderRadius: radius.lg },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  doneOuter: { borderRadius: radius.button, overflow: 'hidden' },
  doneGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
