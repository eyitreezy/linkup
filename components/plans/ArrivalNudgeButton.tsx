import { colors, radius, spacing, fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  planId: string;
  currentUserId: string;
  myNudgedAt?: string | null;
  partnerNudgedAt?: string | null;
  partnerUserId?: string | null;
  onNudged?: () => void;
};

export function ArrivalNudgeButton({
  planId,
  currentUserId,
  myNudgedAt,
  partnerNudgedAt,
  partnerUserId,
  onNudged,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [nudgedAt, setNudgedAt] = useState<string | null>(myNudgedAt ?? null);
  const [disputeEligible, setDisputeEligible] = useState(false);

  useEffect(() => {
    setNudgedAt(myNudgedAt ?? null);
  }, [myNudgedAt]);

  useEffect(() => {
    if (!partnerNudgedAt || nudgedAt) {
      setDisputeEligible(false);
      return;
    }
    const checkEligibility = () => {
      const elapsed = Date.now() - new Date(partnerNudgedAt).getTime();
      setDisputeEligible(elapsed >= 3600000);
    };
    checkEligibility();
    const interval = setInterval(checkEligibility, 60000);
    return () => clearInterval(interval);
  }, [partnerNudgedAt, nudgedAt]);

  const handleNudge = async () => {
    if (nudgedAt || isLoading) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-arrival-nudge', {
        body: { plan_id: planId },
      });
      if (error) throw error;
      const payload = data as { nudged_at?: string; already_nudged?: boolean };
      if (payload?.nudged_at) {
        setNudgedAt(payload.nudged_at);
        onNudged?.();
      }
    } catch {
      // silent — user can retry
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportNoShow = () => {
    if (!partnerUserId) return;
    router.push(
      `/dispute/${planId}?flow=noshow&reportedUserId=${encodeURIComponent(partnerUserId)}` as const
    );
  };

  if (nudgedAt) {
    return (
      <View style={styles.confirmedContainer}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={styles.confirmedText}>You have arrived</Text>
        <Text style={styles.confirmedTime}>
          {new Date(nudgedAt).toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.nudgeContainer}>
      <Pressable
        style={[styles.nudgeButtonOuter, isLoading && styles.nudgeButtonDisabled]}
        onPress={handleNudge}
        disabled={isLoading}
      >
        <LinearGradient
          colors={isLoading ? [colors.border, colors.border] : [colors.primary, '#8B7CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nudgeButtonGradient}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.nudgeButtonLabel}>I Have Arrived</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>

      {partnerNudgedAt ? (
        <Text style={styles.partnerNudgedText}>Your partner has arrived and is waiting.</Text>
      ) : null}

      {disputeEligible && partnerUserId ? (
        <Pressable style={styles.reportButton} onPress={handleReportNoShow}>
          <Text style={styles.reportButtonLabel}>Report No-Show</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nudgeContainer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  nudgeButtonOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  nudgeButtonDisabled: { opacity: 0.6 },
  nudgeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  nudgeButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  confirmedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: radius.lg,
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmedText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.success,
  },
  confirmedTime: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  partnerNudgedText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: '#B45309',
    textAlign: 'center',
  },
  reportButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  reportButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.secondary,
  },
});
