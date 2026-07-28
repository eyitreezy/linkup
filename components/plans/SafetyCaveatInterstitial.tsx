import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  planId: string;
  userId: string;
  onAcknowledged: () => void;
};

export function SafetyCaveatInterstitial({ planId, userId, onAcknowledged }: Props) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      await supabase.from('safety_caveat_acknowledgements').upsert(
        { plan_id: planId, user_id: userId },
        { onConflict: 'plan_id,user_id', ignoreDuplicates: true }
      );
      onAcknowledged();
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          </View>
          <Text style={styles.title}>Your safety comes first</Text>
          <Text style={styles.body}>
            We strongly recommend your first meetup with this person takes place in a public space.
            A restaurant, a cafe, a lounge, or any publicly accessible venue.
          </Text>
          <Text style={styles.bodyBold}>Prioritise your safety. Trust your instincts.</Text>
          <Pressable
            style={[styles.buttonOuter, isAcknowledging && styles.buttonDisabled]}
            onPress={handleAcknowledge}
            disabled={isAcknowledging}
          >
            <LinearGradient
              colors={[colors.primary, '#8B7CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {isAcknowledging ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonLabel}>I understand</Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(94,82,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
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
  bodyBold: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  buttonOuter: { width: '100%', borderRadius: 50, overflow: 'hidden', marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.5 },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
