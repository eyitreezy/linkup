import { colors } from '@/constants/theme';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

type Props = { expiresAtIso: string; tone?: 'brand' | 'onDark' };

function MoodPlanCountdownInner({ expiresAtIso, tone = 'brand' }: Props) {
  const [label, setLabel] = useState(() => formatRemaining(new Date(expiresAtIso).getTime() - Date.now()));

  useEffect(() => {
    const tick = () => setLabel(formatRemaining(new Date(expiresAtIso).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  return (
    <Text style={[styles.txt, tone === 'onDark' && styles.onDark]} numberOfLines={1}>
      {label}
    </Text>
  );
}

export const MoodPlanCountdown = memo(MoodPlanCountdownInner);

const styles = StyleSheet.create({
  txt: { fontSize: 12, fontWeight: '800', color: colors.secondary },
  onDark: { color: 'rgba(255,255,255,0.96)' },
});
