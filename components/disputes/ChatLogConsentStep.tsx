import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  disputeId: string;
  onConsentSubmitted: () => void;
};

export function ChatLogConsentStep({ disputeId, onConsentSubmitted }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConsent = async (consented: boolean) => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      await supabase.from('dispute_chat_log_consents').insert({
        dispute_id: disputeId,
        user_id: user.id,
        consented,
      });
      onConsentSubmitted();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat log access</Text>
      <Text style={styles.body}>
        To assist in resolving this dispute, the LinkUp dispute team may review your in-app
        conversation with the other party. Do you consent?
      </Text>
      <Text style={styles.body}>
        If both parties consent, the full conversation is made available. If only one consents,
        access is limited to messages before the point of non-consent. If neither consents, the
        dispute is resolved on video and written statement evidence only.
      </Text>
      <Text style={styles.body}>Chat logs are never accessed without a live dispute and your consent.</Text>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={styles.buttonRow}>
          <Pressable style={[styles.primaryOuter, styles.buttonFlex]} onPress={() => void handleConsent(true)}>
            <LinearGradient
              colors={[colors.primary, '#8B7CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryLabel}>Yes, share our chat</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, styles.buttonFlex]}
            onPress={() => void handleConsent(false)}
          >
            <Text style={styles.secondaryLabel}>No, do not share</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, padding: spacing.md },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  buttonFlex: { flex: 1 },
  primaryOuter: { borderRadius: radius.button, overflow: 'hidden' },
  primaryGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
    textAlign: 'center',
  },
  secondaryButton: {
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
    textAlign: 'center',
  },
});
