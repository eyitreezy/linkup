/**
 * Live countdown for escrow funding deadline (mood plans = 1h window).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function formatRemain(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

type Props = {
  deadlineIso: string;
  isMoodPlan: boolean;
};

export const FundingDeadlineUrgencyBanner = memo(function FundingDeadlineUrgencyBanner({
  deadlineIso,
  isMoodPlan,
}: Props) {
  const [label, setLabel] = useState(() => formatRemain(new Date(deadlineIso).getTime() - Date.now()));

  useEffect(() => {
    const tick = () => setLabel(formatRemain(new Date(deadlineIso).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);

  const expired = new Date(deadlineIso).getTime() <= Date.now();

  if (expired) {
    return (
      <View style={[styles.wrap, styles.expired]}>
        <Ionicons name="alert-circle" size={22} color={colors.danger} />
        <Text style={styles.expiredTxt}>
          The funding window for this agreement has ended. If escrow wasn’t completed, you may need to agree again or
          contact support.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, isMoodPlan ? styles.mood : styles.normal]}>
      <Ionicons name="flash-outline" size={22} color={isMoodPlan ? '#fff' : colors.primary} />
      <View style={styles.textCol}>
        <Text style={[styles.title, isMoodPlan && styles.titleOnDark]}>
          {isMoodPlan ? 'Mood plan — fund escrow soon' : 'Complete funding'}
        </Text>
        <Text style={[styles.sub, isMoodPlan && styles.subOnDark]}>
          <Text style={[styles.mono, isMoodPlan && styles.monoOnDark]}>{label}</Text> remaining to fund escrow on this
          screen. Automated push and email reminders run if notifications are on in Settings.
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  normal: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.28)',
  },
  mood: {
    backgroundColor: 'rgba(220, 72, 56, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 180, 0.55)',
  },
  expired: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  expiredTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  titleOnDark: { color: '#fff' },
  sub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  subOnDark: { color: 'rgba(255,255,255,0.92)' },
  mono: { fontVariant: ['tabular-nums'], fontWeight: '900', color: colors.primary },
  monoOnDark: { color: '#fff' },
});
