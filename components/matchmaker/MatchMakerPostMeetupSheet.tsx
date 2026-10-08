import { Button } from '@/components/Button';
import { ChoiceChip, ChoiceChipRow } from '@/components/matchmaker/ChoiceChip';
import { Input } from '@/components/Input';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import {
  FEELING_OPTIONS,
  markPostMeetupSkipped,
  savePostMeetupReflection,
  type PostMeetupFeeling,
} from '@/lib/matchmaker/postMeetup';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';

type Step = 'feeling' | 'next_choice' | 'confirm_continue' | 'confirm_end';

type Props = {
  visible: boolean;
  connectionId: string;
  userId: string;
  partnerName: string;
  onClose: () => void;
};

export function MatchMakerPostMeetupSheet({
  visible,
  connectionId,
  userId,
  partnerName,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [step, setStep] = useState<Step>('feeling');
  const [feeling, setFeeling] = useState<PostMeetupFeeling | null>(null);
  const [quality, setQuality] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveFeeling(skipQuality = false) {
    setBusy(true);
    const result = skipQuality
      ? await markPostMeetupSkipped(supabase, connectionId, userId)
      : await savePostMeetupReflection(supabase, connectionId, userId, feeling, quality.trim() || null);
    setBusy(false);
    if (result.error) return;
    setStep('next_choice');
  }

  async function endConnectionFromMeetup() {
    setBusy(true);
    const { error } = await supabase.rpc('matchmaker_end_connection', {
      p_connection_id: connectionId,
      p_reason: 'Not feeling it',
    });
    setBusy(false);
    if (error) return;
    onClose();
    router.replace('/matchmaker/reflect' as Href);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: insets.bottom + spacing.lg }]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {step === 'feeling' ? (
            <>
              <Text style={styles.title}>How did you feel after meeting {partnerName}?</Text>
              <ChoiceChipRow>
                {FEELING_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.id}
                    label={opt.label}
                    selected={feeling === opt.id}
                    onPress={() => setFeeling(opt.id)}
                  />
                ))}
              </ChoiceChipRow>
              <Text style={[styles.title, { marginTop: spacing.lg }]}>
                What quality mattered most to you?
              </Text>
              <Input
                value={quality}
                onChangeText={setQuality}
                placeholder="Type something..."
                variant="onboarding"
                emojiAccessory={false}
              />
              <Button
                title="Save (private)"
                onPress={() => void saveFeeling(false)}
                disabled={!feeling || busy}
                gradient
                pill
                fullWidth
                style={{ marginTop: spacing.md }}
              />
              <Button
                title="Skip for now"
                variant="ghost"
                onPress={() => void saveFeeling(true)}
                disabled={busy}
                fullWidth
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : step === 'next_choice' ? (
            <>
              <Text style={styles.title}>What comes next for you and {partnerName}?</Text>
              <Pressable style={styles.choiceCard} onPress={() => setStep('confirm_continue')}>
                <Text style={styles.choiceTitle}>Continue this connection</Text>
                <Text style={styles.choiceBody}>
                  Keep building what you have started. You can create more plans without the 21-day wait.
                </Text>
              </Pressable>
              <Pressable style={[styles.choiceCard, styles.choiceMuted]} onPress={() => setStep('confirm_end')}>
                <Text style={styles.choiceTitle}>End this connection</Text>
                <Text style={styles.choiceBody}>Close this chapter. A reflection period follows.</Text>
              </Pressable>
            </>
          ) : step === 'confirm_continue' ? (
            <>
              <Text style={styles.title}>Continue this connection?</Text>
              <Text style={styles.body}>Your MatchMaker connection stays active. You can propose another plan anytime.</Text>
              <Button title="Confirm continue" onPress={onClose} gradient pill fullWidth />
              <Button title="Go back" variant="ghost" onPress={() => setStep('next_choice')} fullWidth style={{ marginTop: spacing.sm }} />
            </>
          ) : (
            <>
              <Text style={styles.title}>End this connection?</Text>
              <Text style={styles.body}>This will start the end connection flow for you and {partnerName}.</Text>
              <Button
                title="Confirm end connection"
                onPress={() => void endConnectionFromMeetup()}
                loading={busy}
                gradient
                pill
                fullWidth
              />
              <Button title="Go back" variant="ghost" onPress={() => setStep('next_choice')} fullWidth style={{ marginTop: spacing.sm }} />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 29, 38, 0.45)' },
  sheet: {
    backgroundColor: MM.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: MM.border,
  },
  title: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, lineHeight: 20 },
  choiceCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: MM.accent,
    backgroundColor: MM.surface,
  },
  choiceMuted: { borderColor: MM.border },
  choiceTitle: { fontFamily: fonts.bold, color: MM.text },
  choiceBody: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, lineHeight: 20 },
});
