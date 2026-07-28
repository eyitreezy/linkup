import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onConsented: () => void;
  onDeclined: () => void;
};

export function LiveLocationConsentModal({ visible, onConsented, onDeclined }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConsent = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase
          .from('live_location_consents')
          .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
      }
      onConsented();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDeclined}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share your live location</Text>
          <Text style={styles.body}>
            Live location sharing shows your real-time position to your meetup partner on a map
            inside the plan chat. Your location is only visible to them for the duration you choose.
          </Text>
          <Text style={styles.body}>
            Your location data is not stored by LinkUp after the sharing session ends. It is not
            accessible to the dispute team or admin unless you choose to submit a screenshot as
            evidence. You can withdraw this consent at any time from Settings.
          </Text>
          <Text style={[styles.body, styles.bodyBold]}>
            By continuing, you consent to LinkUp processing your real-time location under the
            Nigeria Data Protection Regulation (NDPR).
          </Text>
          <Pressable
            style={[styles.primaryOuter, isLoading && styles.disabled]}
            onPress={() => void handleConsent()}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.primary, '#8B7CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryLabel}>I consent, share my location</Text>
              )}
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onDeclined}>
            <Text style={styles.secondaryLabel}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    alignSelf: 'center',
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  bodyBold: { fontWeight: '700', fontFamily: fonts.medium, color: colors.text },
  primaryOuter: { borderRadius: radius.button, overflow: 'hidden', marginTop: spacing.xs },
  primaryGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  secondaryButton: {
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  disabled: { opacity: 0.5 },
});
