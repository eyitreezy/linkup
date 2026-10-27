import { Button } from '@/components/Button';
import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { Input } from '@/components/Input';
import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { colors } from '@/constants/theme';
import { openMatchMakerChat } from '@/lib/matchmaker/chat';
import { partnerUserId } from '@/lib/matchmaker/connection';
import { computeMatchMakerJourneyClocks, featureLockedExplanation } from '@/lib/matchmaker/journey';
import {
  sharedActivityWeekDefinition,
  SHARED_ACTIVITY_MAX_WEEKS,
} from '@/lib/matchmaker/sharedActivityCatalog';
import {
  SHARED_ACTIVITY_OTHER_LABEL,
  clampSharedActivityOtherInput,
  formatActivityAnswerDisplay,
  normalizeActivityAnswerForSubmit,
  restoreLocalSelectionFromMyAnswer,
} from '@/lib/matchmaker/sharedActivity';
import { useMatchMakerActivity } from '@/hooks/useMatchMakerActivity';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerActivityScreen() {
  const { id: connectionId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wideActions = width >= 600;
  const { user } = useAuth();
  const { connection } = useMatchMakerConnection(connectionId);
  const isUserA = connection && user?.id ? connection.user_a_id === user.id : false;
  const [activeWeek, setActiveWeek] = useState(1);
  const { phase, activity, loading, refresh } = useMatchMakerActivity(
    connectionId,
    user?.id,
    isUserA,
    activeWeek
  );
  const weekNumber = Math.min(
    SHARED_ACTIVITY_MAX_WEEKS,
    Math.max(1, activity?.week_number ?? activeWeek)
  );

  useEffect(() => {
    if (activity?.week_number && activity.week_number !== activeWeek) {
      setActiveWeek(activity.week_number);
    }
  }, [activity?.week_number, activeWeek]);
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [partnerName, setPartnerName] = useState('Your match');

  const clocks = connection ? computeMatchMakerJourneyClocks(connection) : null;
  const isOtherSelected = selected === SHARED_ACTIVITY_OTHER_LABEL;

  useEffect(() => {
    if (!connection || !user?.id) return;
    const partnerId = partnerUserId(connection, user.id);
    void supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', partnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name?.trim()) setPartnerName(data.display_name.trim());
      });
  }, [connection, user?.id]);

  useEffect(() => {
    if (!activity?.my_answer) return;
    const restored = restoreLocalSelectionFromMyAnswer(activity.my_answer);
    setSelected(restored.selected);
    setOtherText(restored.otherText);
  }, [activity?.my_answer]);

  const catalogWeek = sharedActivityWeekDefinition(weekNumber);

  const question = useMemo(() => {
    const q = activity?.questions;
    if (Array.isArray(q) && typeof q[0] === 'string') return q[0];
    if (q && typeof q === 'object' && 'text' in (q as object)) {
      return String((q as { text: unknown }).text);
    }
    return catalogWeek?.question ?? 'What does your ideal Sunday look like?';
  }, [activity?.questions, catalogWeek?.question]);

  const options = useMemo(() => {
    const q = activity?.questions;
    if (q && typeof q === 'object' && !Array.isArray(q) && Array.isArray((q as { options?: string[] }).options)) {
      return (q as { options: string[] }).options;
    }
    if (catalogWeek?.presets?.length) return [...catalogWeek.presets];
    return [
      'Quiet morning with coffee',
      'Outdoor adventure',
      'Family time at home',
      'Creative or cultural outing',
    ];
  }, [activity?.questions, catalogWeek?.presets]);

  const mineSubmitted = !!activity?.mine_submitted_at;
  const theirsSubmitted = !!activity?.partner_submitted_at;
  const showConcealedPreview =
    !!activity?.partner_answer_concealed && !mineSubmitted && !activity?.revealed_at;

  async function submit() {
    if (!connectionId || submitBusy || mineSubmitted) return;
    const built = normalizeActivityAnswerForSubmit(selected, otherText, isOtherSelected);
    if (!built.ok) {
      Alert.alert('Shared Activity', built.message);
      return;
    }
    setSubmitBusy(true);
    const { error } = await supabase.rpc('matchmaker_submit_activity_answer', {
      p_connection_id: connectionId,
      p_week_number: 1,
      p_answers: built.payload,
    });
    setSubmitBusy(false);
    if (error) {
      Alert.alert('Shared Activity', error.message);
      return;
    }
    await refresh();
  }

  async function openChatShortcut() {
    if (!connectionId || !user?.id || !connection) return;
    const partnerId = partnerUserId(connection, user.id);
    const { conversationId, error } = await openMatchMakerChat(connectionId, user.id, partnerId);
    if (error || !conversationId) {
      Alert.alert('Chat', error ?? 'Could not open chat');
      return;
    }
    router.push(`/chat/${conversationId}` as Href);
  }

  if (connection && clocks && !clocks.sharedActivityUnlocked) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top }]}>
        <Text style={styles.blockedText}>
          {featureLockedExplanation('shared_activity', clocks, connection)}
        </Text>
        <Button title="Back" onPress={() => router.back()} variant="ghost" />
      </View>
    );
  }

  if (loading && !activity) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top }]}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: MM.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={MM.text} />
          </Pressable>
          <Text style={styles.title}>Shared Activity</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.weekLabel}>
          Week {weekNumber} · Question {catalogWeek?.questionNumber ?? 1}
        </Text>

        {phase === 'reveal' ? (
          <View style={styles.reveal}>
            <View style={styles.answerCard}>
              <Text style={styles.answerLabel}>You said</Text>
              <Text style={styles.answerText}>{formatActivityAnswerDisplay(activity?.my_answer)}</Text>
            </View>
            <View style={styles.answerCard}>
              <Text style={styles.answerLabel}>{partnerName} said</Text>
              <Text style={styles.answerText}>{formatActivityAnswerDisplay(activity?.partner_answer)}</Text>
            </View>
            <Text style={styles.revealHint}>You have both answered. Talk about it.</Text>
            <View style={[styles.actionRow, wideActions && styles.actionRowWide]}>
              <Button
                title="Open chat"
                onPress={() => void openChatShortcut()}
                gradient
                pill
                fullWidth={!wideActions}
                style={wideActions ? styles.actionBtnWide : undefined}
              />
              <Button
                title="Back to connection"
                onPress={() => router.back()}
                variant="ghost"
                pill
                fullWidth={!wideActions}
                style={[wideActions ? styles.actionBtnWide : undefined, styles.secondaryBtn]}
                textStyle={styles.secondaryBtnText}
              />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.question}>{question}</Text>

            {showConcealedPreview ? (
              <View style={styles.concealedWrap}>
                <View style={styles.concealedInner}>
                  <Text style={styles.concealedPlaceholder}>
                    {partnerName} shared their answer. Add yours to reveal both.
                  </Text>
                  <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                </View>
                <Text style={styles.concealedHint}>Their answer stays hidden until you submit yours.</Text>
              </View>
            ) : null}

            {phase === 'waiting' ? (
              <View style={styles.statusBlock}>
                <Text style={styles.statusLine}>Your answer: submitted</Text>
                <Text style={styles.statusLine}>{partnerName}&apos;s answer: still thinking...</Text>
                <Text style={styles.waitingBody}>
                  We will reveal both answers the moment {partnerName} submits theirs.
                </Text>
                <View style={[styles.actionRow, wideActions && styles.actionRowWide, { marginTop: spacing.lg }]}>
                  <Button
                    title="Open chat"
                    onPress={() => void openChatShortcut()}
                    gradient
                    pill
                    fullWidth={!wideActions}
                    style={wideActions ? styles.actionBtnWide : undefined}
                  />
                  <Button
                    title="Back to connection"
                    onPress={() => router.back()}
                    variant="ghost"
                    pill
                    fullWidth={!wideActions}
                    style={[wideActions ? styles.actionBtnWide : undefined, styles.secondaryBtn]}
                    textStyle={styles.secondaryBtnText}
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.statusBlock}>
                  <Text style={styles.statusLine}>
                    Your answer: {mineSubmitted ? 'submitted' : 'not yet submitted'}
                  </Text>
                  <Text style={styles.statusLine}>
                    {partnerName}&apos;s answer: {theirsSubmitted ? 'submitted' : 'waiting for them'}
                  </Text>
                </View>
                <ChoiceChipRow>
                  {options.map((opt) => (
                    <ChoiceChip
                      key={opt}
                      label={opt}
                      selected={selected === opt}
                      onPress={() => {
                        setSelected(opt);
                        setOtherText('');
                      }}
                    />
                  ))}
                  <ChoiceChip
                    label={SHARED_ACTIVITY_OTHER_LABEL}
                    selected={isOtherSelected}
                    onPress={() => setSelected(SHARED_ACTIVITY_OTHER_LABEL)}
                  />
                </ChoiceChipRow>
                {isOtherSelected ? (
                  <View style={styles.otherField}>
                    <Input
                      value={otherText}
                      onChangeText={(t) => setOtherText(clampSharedActivityOtherInput(t))}
                      placeholder="Please enter your answer"
                      maxLength={100}
                      multiline
                      variant="onboarding"
                      emojiAccessory={false}
                      style={styles.otherInput}
                    />
                    <Text style={styles.counter}>{otherText.length}/100</Text>
                  </View>
                ) : null}
                <Button
                  title="Submit my answer"
                  onPress={() => void submit()}
                  disabled={!selected || mineSubmitted || submitBusy}
                  loading={submitBusy}
                  gradient
                  pill
                  fullWidth
                  style={{ marginTop: spacing.lg }}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const outlineBorder = '#EDE0D4';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  weekLabel: { fontFamily: fonts.medium, color: MM.muted, fontSize: 12, marginBottom: spacing.sm },
  question: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: MM.text,
    lineHeight: 28,
    marginBottom: spacing.lg,
  },
  statusBlock: { marginBottom: spacing.md, gap: 4 },
  statusLine: { fontFamily: fonts.regular, color: MM.muted, fontSize: 13 },
  waitingBody: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, lineHeight: 20 },
  reveal: { gap: spacing.md },
  answerCard: {
    backgroundColor: MM.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
  },
  answerLabel: { fontFamily: fonts.medium, color: MM.muted, fontSize: 12 },
  answerText: { marginTop: spacing.sm, fontFamily: fonts.bold, color: MM.text, fontSize: 16 },
  revealHint: { textAlign: 'center', fontStyle: 'italic', color: MM.muted, fontFamily: fonts.regular },
  actionRow: { gap: spacing.sm, width: '100%' },
  actionRowWide: { flexDirection: 'row', alignItems: 'stretch' },
  actionBtnWide: { flex: 1 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: outlineBorder,
    backgroundColor: '#fff',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: MM.text, fontFamily: fonts.bold },
  concealedWrap: { marginBottom: spacing.lg },
  concealedInner: {
    minHeight: 88,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    backgroundColor: MM.surfaceWarm,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: spacing.md,
  },
  concealedPlaceholder: {
    fontFamily: fonts.medium,
    color: MM.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  concealedHint: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: MM.muted,
    textAlign: 'center',
  },
  otherField: { marginTop: spacing.md },
  otherInput: { minHeight: 88, textAlignVertical: 'top' },
  counter: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'right',
  },
  blocked: { flex: 1, backgroundColor: MM.bg, padding: spacing.lg, justifyContent: 'center' },
  blockedText: { fontFamily: fonts.regular, color: MM.muted, marginBottom: spacing.lg, textAlign: 'center' },
});
