import { MM, MM_CTA_GRADIENT, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { useMatchMakerActivity } from '@/hooks/useMatchMakerActivity';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { useAuth } from '@/contexts/AuthContext';
import { partnerUserId } from '@/lib/matchmaker/connection';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OPTIONS = [
  'Quiet morning with coffee',
  'Outdoor adventure',
  'Family time at home',
  'Creative or cultural outing',
];

export default function MatchMakerActivityScreen() {
  const { id: connectionId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { connection } = useMatchMakerConnection(connectionId);
  const isUserA = connection && user?.id ? connection.user_a_id === user.id : false;
  const { phase, activity } = useMatchMakerActivity(connectionId, user?.id, isUserA);
  const [selected, setSelected] = useState<string | null>(null);
  const partnerName = 'Your match';

  const myAnswers = useMemo(() => {
    if (!activity) return null;
    return isUserA ? activity.user_a_answers : activity.user_b_answers;
  }, [activity, isUserA]);

  const theirAnswers = useMemo(() => {
    if (!activity) return null;
    return isUserA ? activity.user_b_answers : activity.user_a_answers;
  }, [activity, isUserA]);

  async function submit() {
    if (!selected || !connectionId) return;
    const { data } = await supabase.rpc('matchmaker_submit_activity_answer', {
      p_connection_id: connectionId,
      p_week_number: 1,
      p_answers: selected,
    });
    const revealed = (data as { revealed?: boolean } | null)?.revealed === true;
    if (revealed) {
      router.replace(`/matchmaker/connection/${connectionId}/activity` as Href);
    } else {
      router.back();
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: MM.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={MM.text} />
        </Pressable>
        <Text style={styles.title}>Shared Activity</Text>
        <View style={{ width: 24 }} />
      </View>

      {phase === 'reveal' ? (
        <View style={styles.reveal}>
          <View style={styles.answerCard}>
            <Text style={styles.answerLabel}>You said</Text>
            <Text style={styles.answerText}>{String(myAnswers ?? selected ?? '')}</Text>
          </View>
          <View style={styles.answerCard}>
            <Text style={styles.answerLabel}>{partnerName} said</Text>
            <Text style={styles.answerText}>{String(theirAnswers ?? '')}</Text>
          </View>
          <Text style={styles.revealHint}>You have both answered. Talk about it.</Text>
          <Pressable onPress={() => router.back()}>
            <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
              <Text style={styles.ctaText}>Open chat</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : phase === 'waiting' ? (
        <View style={styles.waiting}>
          <Text style={styles.question}>What does your ideal Sunday look like?</Text>
          <Text style={styles.waitingBody}>We will reveal both answers the moment they submit theirs.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.question}>What does your ideal Sunday look like?</Text>
          {OPTIONS.map((opt) => (
            <Pressable key={opt} onPress={() => setSelected(opt)} style={[styles.option, selected === opt && styles.optionOn]}>
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          ))}
          <Pressable disabled={!selected} onPress={() => void submit()} style={{ marginTop: spacing.lg }}>
            <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
              <Text style={styles.ctaText}>Submit my answer</Text>
            </LinearGradient>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  question: { fontSize: 20, fontFamily: fonts.bold, color: MM.text, lineHeight: 28, marginBottom: spacing.lg },
  option: { borderWidth: 1, borderColor: MM.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, backgroundColor: MM.surface },
  optionOn: { borderColor: MM.primary, backgroundColor: '#EEEDFF' },
  optionText: { fontFamily: fonts.medium, color: MM.text },
  cta: { borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontFamily: fonts.bold },
  waiting: { paddingTop: spacing.xl },
  waitingBody: { fontFamily: fonts.regular, color: MM.muted, lineHeight: 20 },
  reveal: { gap: spacing.md },
  answerCard: { backgroundColor: MM.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: MM.border, padding: spacing.md },
  answerLabel: { fontFamily: fonts.medium, color: MM.muted, fontSize: 12 },
  answerText: { marginTop: spacing.sm, fontFamily: fonts.bold, color: MM.text, fontSize: 16 },
  revealHint: { textAlign: 'center', fontStyle: 'italic', color: MM.muted, fontFamily: fonts.regular },
});
