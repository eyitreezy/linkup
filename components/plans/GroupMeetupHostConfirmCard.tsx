import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  planId: string;
  confirmedGuestCount?: number;
  totalGuests?: number;
  onConfirmed?: () => void;
};

export function GroupMeetupHostConfirmCard({
  planId,
  confirmedGuestCount = 0,
  totalGuests = 0,
  onConfirmed,
}: Props) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const { error } = await supabase.rpc('submit_group_meetup_confirmation', {
        p_plan_id: planId,
      });
      if (!error) {
        setDone(true);
        onConfirmed?.();
      }
    } finally {
      setIsConfirming(false);
    }
  };

  if (done) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Meetup confirmed</Text>
        <Text style={styles.body}>
          Guests have been notified to confirm attendance or submit an Exigency Report.
        </Text>
        {totalGuests > 0 ? (
          <Text style={styles.meta}>
            {confirmedGuestCount} of {totalGuests} guests confirmed so far
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Confirm the meetup happened</Text>
      <Text style={styles.body}>
        Confirming the meetup lets your guests know the plan succeeded and starts the disbursement
        process for all confirmed members.
      </Text>
      <Pressable
        style={[styles.buttonOuter, isConfirming && styles.buttonDisabled]}
        onPress={() => void handleConfirm()}
        disabled={isConfirming}
      >
        <LinearGradient
          colors={isConfirming ? [colors.border, colors.border] : [colors.primary, '#8B7CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonLabel}>Confirm Group Meetup Completed</Text>
          )}
        </LinearGradient>
      </Pressable>
      <Text style={styles.caption}>
        Members who do not confirm within 24 hours will have an automatic outcome applied.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.15)',
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  meta: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  buttonOuter: { borderRadius: 50, overflow: 'hidden', marginTop: spacing.xs },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
