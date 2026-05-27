/**
 * Mood plan configuration — chips, window, listing TTL, live preview of discover expiry.
 */
import { authSoftLabelStyle, planCreateTouchableFieldStyle } from '@/components/Input';
import { GradientSelectionChip } from '@/components/ui/GradientSelectionChip';
import { colors, radius, spacing } from '@/constants/theme';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import {
  computeMoodExpiresAt,
  computeMoodWindowBounds,
  type MoodListingHours,
  type MoodWindowPreset,
} from '@/lib/plans/moodPlanComputations';
import { applyMoodPlanLiveNow } from '@/lib/plans/moodPlanStart';
import { fetchActiveMeetTypes } from '@/lib/plans/meetTypes';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

const MOOD_TYPES = [
  { id: 'chill', label: 'Chill' },
  { id: 'spontaneous', label: 'Spontaneous' },
  { id: 'active', label: 'Active' },
  { id: 'social', label: 'Social' },
  { id: 'premium', label: 'Premium' },
  { id: 'late_night', label: 'Late night' },
  { id: 'adventure', label: 'Adventure' },
] as const;

const WINDOWS: { id: MoodWindowPreset; label: string }[] = [
  { id: 'now', label: 'Starts now' },
  { id: 'within_1h', label: 'Within 1 hour' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'custom', label: 'Custom' },
];

const EXPIRIES: { h: MoodListingHours; label: string }[] = [
  { h: 1, label: '1h' },
  { h: 3, label: '3h' },
  { h: 6, label: '6h' },
  { h: 12, label: '12h' },
  { h: 24, label: '24h' },
];

function defaultCustomEnd(scheduledAt: Date | null): Date {
  const now = new Date();
  if (scheduledAt && scheduledAt.getTime() > now.getTime()) return new Date(scheduledAt.getTime());
  return new Date(now.getTime() + 2 * 3600000);
}

function openAndroidDateTime(value: Date, minimumDate: Date | undefined, onDone: (d: Date) => void) {
  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    minimumDate,
    onChange: (e, date) => {
      if (e.type === 'dismissed' || !date) return;
      const merged = new Date(date);
      merged.setHours(value.getHours(), value.getMinutes(), 0, 0);
      setTimeout(() => {
        DateTimePickerAndroid.open({
          value: merged,
          mode: 'time',
          is24Hour: false,
          onChange: (ev, timeDate) => {
            if (ev.type === 'dismissed' || !timeDate) return;
            onDone(timeDate);
          },
        });
      }, 0);
    },
  });
}

export function MoodPlanFieldsSection() {
  const { draft, setDraft } = usePlanDraft();
  const [supportsMood, setSupportsMood] = useState(false);
  const [iosCustomPick, setIosCustomPick] = useState<null | 'start' | 'end'>(null);

  useEffect(() => {
    void fetchActiveMeetTypes().then(({ rows }) => {
      const t = rows.find((r) => r.id === draft.meetTypeId);
      setSupportsMood(!!t?.supports_mood);
    });
  }, [draft.meetTypeId]);

  const previewExpiry = useMemo(() => {
    if (!draft.isMoodPlan || !draft.scheduledAt) return null;
    try {
      return computeMoodExpiresAt({
        scheduledAt: draft.scheduledAt,
        listingHours: draft.moodListingHours,
        window: draft.moodWindow,
        customStart: draft.moodCustomStart,
        customEnd: draft.moodCustomEnd,
      });
    } catch {
      return null;
    }
  }, [
    draft.isMoodPlan,
    draft.scheduledAt,
    draft.moodListingHours,
    draft.moodWindow,
    draft.moodCustomStart,
    draft.moodCustomEnd,
  ]);

  const bounds = useMemo(() => {
    if (!draft.scheduledAt) return null;
    return computeMoodWindowBounds(
      draft.moodWindow,
      draft.moodCustomStart,
      draft.moodCustomEnd,
      draft.scheduledAt
    );
  }, [draft.moodWindow, draft.moodCustomStart, draft.moodCustomEnd, draft.scheduledAt]);

  useEffect(() => {
    if (draft.moodWindow !== 'custom') setIosCustomPick(null);
  }, [draft.moodWindow]);

  function patchCustomTimes(start: Date, end: Date) {
    const now = new Date();
    setDraft((d) => {
      let s = start.getTime() < now.getTime() ? now : start;
      let e = end;
      if (e.getTime() <= s.getTime()) e = new Date(s.getTime() + 15 * 60000);
      return applyMoodPlanLiveNow({ ...d, moodWindow: 'custom', moodCustomStart: s, moodCustomEnd: e });
    });
  }

  function openCustomStartPicker() {
    const now = new Date();
    const endDef = defaultCustomEnd(now);
    const start =
      draft.moodCustomStart && draft.moodCustomStart.getTime() >= now.getTime()
        ? draft.moodCustomStart
        : now;
    const end = draft.moodCustomEnd ?? endDef;
    if (Platform.OS === 'android') {
      openAndroidDateTime(start, now, (picked) =>
        patchCustomTimes(
          picked,
          end.getTime() <= picked.getTime() ? new Date(picked.getTime() + 60 * 60000) : end
        )
      );
      return;
    }
    setIosCustomPick('start');
  }

  function openCustomEndPicker() {
    const now = new Date();
    const start =
      draft.moodCustomStart && draft.moodCustomStart.getTime() >= now.getTime()
        ? draft.moodCustomStart
        : now;
    const min = start;
    const end = draft.moodCustomEnd ?? defaultCustomEnd(now);
    if (Platform.OS === 'android') {
      openAndroidDateTime(end, min, (picked) => patchCustomTimes(start, picked));
      return;
    }
    setIosCustomPick('end');
  }

  if (!supportsMood) return null;

  return (
    <MotiView
      from={{ opacity: 0.88 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 280 }}
      style={styles.block}
    >
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={styles.sectionLabel}>Mood plan</Text>
          <Text style={styles.hint}>Short visibility window, urgency in Discover — same rules as before, richer config.</Text>
        </View>
        <Switch
          value={draft.isMoodPlan}
          onValueChange={(v) => {
            setDraft((d) => {
              if (!v) return { ...d, isMoodPlan: false, moodExpiresAt: null };
              const base = d.scheduledAt ? d : { ...d, scheduledAt: new Date() };
              return {
                ...applyMoodPlanLiveNow({ ...base, isMoodPlan: true, moodType: base.moodType ?? 'chill' }),
              };
            });
          }}
          trackColor={{ true: colors.secondary, false: '#ccc' }}
        />
      </View>

      {draft.isMoodPlan ? (
        <>
          <Text style={styles.subLabel}>Mood type</Text>
          <View style={styles.chipRow}>
            {MOOD_TYPES.map((m) => (
              <GradientSelectionChip
                key={m.id}
                label={m.label}
                selected={draft.moodType === m.id}
                onPress={() => setDraft((d) => ({ ...d, moodType: m.id }))}
              />
            ))}
          </View>

          <Text style={styles.subLabel}>Time window</Text>
          <View style={styles.chipRow}>
            {WINDOWS.map((w) => (
              <GradientSelectionChip
                key={w.id}
                label={w.label}
                compact
                selected={draft.moodWindow === w.id}
                onPress={() =>
                  setDraft((d) => {
                    let moodCustomStart = d.moodCustomStart;
                    let moodCustomEnd = d.moodCustomEnd;
                    if (w.id === 'custom') {
                      const now = new Date();
                      const endDef = defaultCustomEnd(now);
                      moodCustomStart =
                        moodCustomStart && moodCustomStart.getTime() >= now.getTime()
                          ? moodCustomStart
                          : now;
                      moodCustomEnd = moodCustomEnd ?? endDef;
                      if (moodCustomEnd.getTime() <= moodCustomStart.getTime()) {
                        moodCustomEnd = new Date(moodCustomStart.getTime() + 15 * 60000);
                      }
                    }
                    return applyMoodPlanLiveNow({
                      ...d,
                      moodWindow: w.id,
                      moodCustomStart,
                      moodCustomEnd,
                    });
                  })
                }
              />
            ))}
          </View>

          {draft.moodWindow === 'custom' ? (
            <>
              <Text style={styles.subLabel}>Custom window</Text>
              <Text style={authSoftLabelStyle}>Starts</Text>
              <Pressable
                onPress={openCustomStartPicker}
                style={({ pressed }) => [
                  ...planCreateTouchableFieldStyle({ marginBottom: spacing.sm }),
                  pressed && styles.datePressed,
                ]}
              >
                <Text style={styles.customFieldTxt}>
                  {draft.moodCustomStart
                    ? draft.moodCustomStart.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Tap to set'}
                </Text>
              </Pressable>
              <Text style={authSoftLabelStyle}>Ends</Text>
              <Pressable
                onPress={openCustomEndPicker}
                style={({ pressed }) => [
                  ...planCreateTouchableFieldStyle({ marginBottom: spacing.sm }),
                  pressed && styles.datePressed,
                ]}
              >
                <Text style={styles.customFieldTxt}>
                  {draft.moodCustomEnd
                    ? draft.moodCustomEnd.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Tap to set'}
                </Text>
              </Pressable>
              {Platform.OS === 'ios' && iosCustomPick === 'start' ? (
                <DateTimePicker
                  value={draft.moodCustomStart ?? new Date()}
                  mode="datetime"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    if (!date || !draft.scheduledAt) return;
                    const end = draft.moodCustomEnd ?? defaultCustomEnd(draft.scheduledAt);
                    patchCustomTimes(
                      date,
                      end.getTime() <= date.getTime() ? new Date(date.getTime() + 60 * 60000) : end
                    );
                  }}
                />
              ) : null}
              {Platform.OS === 'ios' && iosCustomPick === 'end' && draft.moodCustomStart ? (
                <DateTimePicker
                  value={draft.moodCustomEnd ?? new Date(draft.moodCustomStart.getTime() + 3600000)}
                  mode="datetime"
                  display="spinner"
                  minimumDate={draft.moodCustomStart}
                  onChange={(_, date) => {
                    if (!date || !draft.moodCustomStart) return;
                    patchCustomTimes(draft.moodCustomStart, date);
                  }}
                />
              ) : null}
              {Platform.OS === 'ios' ? (
                <Pressable onPress={() => setIosCustomPick(null)} style={styles.iosDoneRow}>
                  <Text style={styles.iosDoneTxt}>Done editing window</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          <Text style={styles.subLabel}>Listing duration (Discover)</Text>
          <View style={styles.chipRow}>
            {EXPIRIES.map(({ h, label }) => (
              <GradientSelectionChip
                key={h}
                label={label}
                selected={draft.moodListingHours === h}
                onPress={() => setDraft((d) => applyMoodPlanLiveNow({ ...d, moodListingHours: h }))}
              />
            ))}
          </View>

          {bounds ? (
            <Text style={styles.meta}>
              Social window · {bounds.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
              {bounds.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
          {previewExpiry ? (
            <View style={styles.previewRow}>
              <Ionicons name="flash-outline" size={18} color={colors.secondary} />
              <Text style={styles.previewTxt}>
                Drops from mood boost at {previewExpiry.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  block: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,120,80,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,80,0.3)',
    marginBottom: spacing.lg,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
  subLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginTop: spacing.md, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  previewTxt: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
  customFieldTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
  datePressed: { opacity: 0.92 },
  iosDoneRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  iosDoneTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
});
