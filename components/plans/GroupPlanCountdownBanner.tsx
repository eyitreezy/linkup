import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  /** ISO timestamp when the confirmation window closes (typically scheduled_at + 24h). */
  deadlineAt: string;
  label?: string;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Window closed';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} left`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function GroupPlanCountdownBanner({
  deadlineAt,
  label = 'Confirmation window closes in',
}: Props) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const ms = new Date(deadlineAt).getTime() - Date.now();
      setRemaining(formatRemaining(ms));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [deadlineAt]);

  const urgent = remaining.includes('h') && !remaining.includes('day') && remaining !== 'Window closed';

  return (
    <View style={[styles.banner, urgent && styles.bannerUrgent]}>
      <Ionicons name="time-outline" size={18} color={urgent ? '#B45309' : colors.primary} />
      <View style={styles.copy}>
        <Text style={[styles.label, urgent && styles.labelUrgent]}>{label}</Text>
        <Text style={[styles.time, urgent && styles.labelUrgent]}>{remaining}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(94,82,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.2)',
    marginBottom: spacing.md,
  },
  bannerUrgent: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  copy: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  labelUrgent: { color: '#B45309' },
  time: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.primary,
    marginTop: 2,
  },
});
