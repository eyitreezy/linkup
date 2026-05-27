/**
 * Bumble-style modal when an outgoing message is blocked for contact sharing.
 */
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { CONTACT_SHARE_BLOCKED_BODY } from '@/lib/messaging/contactSharePolicy';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function ContactShareBlockedModal({ visible, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-half-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.body}>{CONTACT_SHARE_BLOCKED_BODY}</Text>
          <Button title="Got it" onPress={onDismiss} pill style={styles.cta} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 29, 38, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  body: {
    marginTop: spacing.xs,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  cta: { marginTop: spacing.lg },
});
