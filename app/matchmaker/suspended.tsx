import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { fetchMatchMakerGateState } from '@/lib/matchmaker/gates';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerSuspendedScreen() {
  const insets = useSafeAreaInsets();
  const [until, setUntil] = useState<string | null>(null);

  useEffect(() => {
    void fetchMatchMakerGateState().then((s) => setUntil(s.cooldown_until ?? null));
  }, []);

  const daysLeft = until
    ? Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + spacing.lg }]}>
      {!until ? (
        <ActivityIndicator color={MM.accent} />
      ) : (
        <>
          <Ionicons name="time-outline" size={48} color={MM.muted} />
          <Text style={styles.title}>MatchMaker access is paused</Text>
          <Text style={styles.body}>
            MatchMaker is built for intentional connections. All other LinkUp features remain available.
          </Text>
          {daysLeft != null ? <Text style={styles.days}>{daysLeft} days remaining</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg, alignItems: 'center', paddingHorizontal: spacing.lg },
  title: { marginTop: spacing.lg, fontSize: 22, fontFamily: fonts.bold, color: MM.text, textAlign: 'center' },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', lineHeight: 22 },
  days: { marginTop: spacing.lg, fontFamily: fonts.bold, color: MM.accent },
});
