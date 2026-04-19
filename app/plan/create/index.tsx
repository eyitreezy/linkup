/**
 * PL1 — Hinge-style details + Tinder-clean layout.
 */
import { Button } from '@/components/Button';
import { authSoftLabelStyle, Input, planCreateTouchableFieldStyle } from '@/components/Input';
import { PlanLocationSection } from '@/components/plans/create/PlanLocationSection';
import { Screen } from '@/components/Screen';
import { VerificationHardGateModal } from '@/components/kyc/VerificationHardGateModal';
import { colors, radius, spacing } from '@/constants/theme';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { useAuth } from '@/contexts/AuthContext';
import { requiresVerificationGate } from '@/lib/verification/access';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const EXAMPLES = ['Dinner in Lekki tonight', 'Gym partner this weekend', 'Coffee walk after work'];

function clampScheduledNotPast(d: Date): Date {
  const now = new Date();
  if (d.getTime() >= now.getTime()) return d;
  const bumped = new Date(now);
  bumped.setMinutes(bumped.getMinutes() + 1, 0, 0);
  return bumped;
}

export default function CreatePlanDetailsScreen() {
  const { draft, setDraft } = usePlanDraft();
  const { dbUser } = useAuth();
  /** iOS: inline datetime picker. Android: `datetime` mode is invalid — use `androidPick` date → time instead. */
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [androidPick, setAndroidPick] = useState<'idle' | 'date' | 'time'>('idle');
  const [gateOpen, setGateOpen] = useState(false);

  function continueNext() {
    if (!draft.title.trim()) {
      return;
    }
    if (!draft.scheduledAt) {
      return;
    }
    router.push('/plan/create/visibility');
  }

  function onContinue() {
    if (requiresVerificationGate(dbUser?.verification_status)) {
      setGateOpen(true);
      return;
    }
    continueNext();
  }

  return (
    <Screen scroll>
      <VerificationHardGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        verificationStatus={dbUser?.verification_status}
      />
      <Text style={styles.lead}>What do you want to do?</Text>
      <Text style={styles.sub}>Short title, optional story, where and when. You can refine visibility next.</Text>

      <View style={styles.examples}>
        <Text style={styles.exLabel}>Ideas</Text>
        {EXAMPLES.map((ex) => (
          <Pressable key={ex} onPress={() => setDraft((d) => ({ ...d, title: ex }))} style={styles.exChip}>
            <Text style={styles.exChipTxt}>{ex}</Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Title"
        variant="onboardingFlat"
        value={draft.title}
        onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))}
        placeholder="e.g. Dinner in Lekki tonight"
      />
      <Input
        label="Description (optional)"
        variant="onboardingFlat"
        multiline
        numberOfLines={4}
        value={draft.description}
        onChangeText={(t) => setDraft((d) => ({ ...d, description: t }))}
        placeholder="Intent, vibe, or what you’re offering"
      />

      <PlanLocationSection
        locationLabel={draft.locationLabel}
        onApply={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />

      <Text style={authSoftLabelStyle}>Date & time</Text>
      <Pressable
        onPress={() => {
          if (Platform.OS === 'android') setAndroidPick('date');
          else setIosPickerOpen(true);
        }}
        style={({ pressed }) => [
          ...planCreateTouchableFieldStyle({ marginBottom: spacing.md }),
          pressed && styles.datePressed,
        ]}
      >
        <Text style={styles.dateTxt}>
          {draft.scheduledAt
            ? draft.scheduledAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
            : 'Pick a time'}
        </Text>
      </Pressable>
      {Platform.OS === 'ios' && iosPickerOpen ? (
        <DateTimePicker
          value={draft.scheduledAt ?? new Date()}
          mode="datetime"
          display="spinner"
          minimumDate={new Date()}
          onChange={(_ev, date) => {
            if (date) setDraft((d) => ({ ...d, scheduledAt: clampScheduledNotPast(date) }));
          }}
        />
      ) : null}
      {Platform.OS === 'android' && androidPick === 'date' ? (
        <DateTimePicker
          value={draft.scheduledAt ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(ev, date) => {
            setAndroidPick('idle');
            if (ev.type === 'dismissed' || !date) return;
            setDraft((d) => {
              const base = d.scheduledAt ?? new Date();
              const next = new Date(date);
              next.setHours(base.getHours(), base.getMinutes(), 0, 0);
              return { ...d, scheduledAt: clampScheduledNotPast(next) };
            });
            requestAnimationFrame(() => setAndroidPick('time'));
          }}
        />
      ) : null}
      {Platform.OS === 'android' && androidPick === 'time' ? (
        <DateTimePicker
          value={draft.scheduledAt ?? new Date()}
          mode="time"
          display="default"
          onChange={(ev, date) => {
            setAndroidPick('idle');
            if (ev.type === 'dismissed' || !date) return;
            setDraft((d) => {
              const base = d.scheduledAt ?? new Date();
              const next = new Date(base);
              next.setHours(date.getHours(), date.getMinutes(), 0, 0);
              return { ...d, scheduledAt: clampScheduledNotPast(next) };
            });
          }}
        />
      ) : null}

      <Input
        label="Price hint (optional)"
        variant="onboardingFlat"
        keyboardType="decimal-pad"
        value={draft.startingPrice}
        onChangeText={(t) => setDraft((d) => ({ ...d, startingPrice: t }))}
        placeholder="Leave empty for open offers"
      />

      <Button
        title="Continue"
        onPress={onContinue}
        disabled={!draft.title.trim() || !draft.scheduledAt}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4, marginBottom: 8 },
  sub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  examples: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  exLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginBottom: 8 },
  exChip: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    marginBottom: 8,
  },
  exChipTxt: { fontSize: 14, fontWeight: '600', color: colors.primary },
  datePressed: { opacity: 0.96 },
  dateTxt: { fontSize: 16, fontWeight: '600', color: colors.text },
  cta: { marginTop: spacing.md },
});
