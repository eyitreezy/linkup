/**
 * Step 1 — meet type catalog + custom type modal only.
 */
import { GradientSelectionChip } from '@/components/ui/GradientSelectionChip';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { insertUserMeetType } from '@/lib/plans/insertUserMeetType';
import { fetchActiveMeetTypes } from '@/lib/plans/meetTypes';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbMeetType, EscrowPattern } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export function MeetTypeSelectorSection() {
  const { draft, setDraft } = usePlanDraft();
  const { user } = useAuth();
  const [types, setTypes] = useState<DbMeetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [creatingType, setCreatingType] = useState(false);

  const reloadTypes = async () => {
    const { rows } = await fetchActiveMeetTypes();
    setTypes(rows);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { rows } = await fetchActiveMeetTypes();
      if (cancelled) return;
      setTypes(rows);
      setLoading(false);
      setDraft((d) => {
        if (d.meetTypeId || rows.length === 0) return d;
        const dinner = rows.find((t) => t.slug === 'dinner') ?? rows[0];
        return {
          ...d,
          meetTypeId: dinner.id,
          durationMinutes: dinner.default_duration_minutes,
          escrowPattern: (dinner.default_pattern as EscrowPattern) ?? 'A',
        };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [setDraft]);

  const selectedType = useMemo(
    () => types.find((t) => t.id === draft.meetTypeId) ?? null,
    [types, draft.meetTypeId]
  );

  useEffect(() => {
    if (!selectedType?.supports_mood && draft.isMoodPlan) {
      setDraft((d) => ({ ...d, isMoodPlan: false, moodExpiresAt: null }));
    }
  }, [selectedType?.supports_mood, draft.isMoodPlan, setDraft]);

  const previewIcon = inferMeetTypeIcon(newTypeName);

  async function onCreateMeetType() {
    const name = newTypeName.trim();
    if (!user?.id || !isSupabaseConfigured) {
      Alert.alert('Sign in', 'You need to be signed in to add a meet type.');
      return;
    }
    if (!name) {
      Alert.alert('Name', 'Enter a short title for your meet type.');
      return;
    }
    setCreatingType(true);
    const { row, error } = await insertUserMeetType(supabase, user.id, name);
    setCreatingType(false);
    if (error || !row) {
      Alert.alert('Could not create type', error ?? 'Unknown error');
      return;
    }
    setNewTypeName('');
    setAddOpen(false);
    await reloadTypes();
    setDraft((d) => ({
      ...d,
      meetTypeId: row.id,
      durationMinutes: row.default_duration_minutes,
      escrowPattern: (row.default_pattern as EscrowPattern) ?? d.escrowPattern ?? 'A',
      isMoodPlan: row.supports_mood ? d.isMoodPlan : false,
      moodExpiresAt: row.supports_mood ? d.moodExpiresAt : null,
    }));
  }

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Meet type</Text>
      <Text style={styles.hint}>Pick a vibe or add your own — same catalog as before.</Text>
      <View style={styles.chipRow}>
        {types.map((t) => {
          const on = draft.meetTypeId === t.id;
          return (
            <GradientSelectionChip
              key={t.id}
              selected={on}
              onPress={() =>
                setDraft((d) => ({
                  ...d,
                  meetTypeId: t.id,
                  durationMinutes: t.default_duration_minutes,
                  escrowPattern: (t.default_pattern as EscrowPattern) ?? d.escrowPattern ?? 'A',
                  isMoodPlan: t.supports_mood ? d.isMoodPlan : false,
                  moodExpiresAt: t.supports_mood ? d.moodExpiresAt : null,
                }))
              }
            >
              <View style={styles.typeChipInner}>
                <Ionicons
                  name={(t.icon as keyof typeof Ionicons.glyphMap) ?? 'ellipse-outline'}
                  size={16}
                  color={on ? '#fff' : colors.primary}
                />
                <Text style={[styles.typeChipTxt, on && styles.typeChipTxtOn]}>{t.name}</Text>
              </View>
            </GradientSelectionChip>
          );
        })}
        <Pressable onPress={() => setAddOpen(true)} style={styles.addChip} accessibilityRole="button" accessibilityLabel="Add custom meet type">
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addChipTxt}>New</Text>
        </Pressable>
      </View>

      <Modal visible={addOpen} animationType="fade" transparent onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>New meet type</Text>
            <Text style={styles.modalHint}>We’ll pick an icon from your title.</Text>
            <View style={styles.modalPreview}>
              <Ionicons name={previewIcon} size={28} color={colors.primary} />
              <Text style={styles.modalPreviewLabel}>Preview icon</Text>
            </View>
            <TextInput
              value={newTypeName}
              onChangeText={setNewTypeName}
              placeholder="e.g. Board games night"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              autoCorrect
              autoCapitalize="sentences"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAddOpen(false)} style={styles.modalGhostBtn}>
                <Text style={styles.modalGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onCreateMeetType()}
                disabled={creatingType}
                style={[styles.modalPrimaryOuter, creatingType && styles.modalPrimaryDisabled]}
              >
                <LinearGradient
                  colors={[...APP_CTA_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalPrimaryBtn}
                >
                  {creatingType ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryTxt}>Create</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  typeChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChipTxt: { fontWeight: '700', color: colors.text },
  typeChipTxtOn: { color: '#fff' },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: 'rgba(108,99,255,0.06)',
  },
  addChipTxt: { fontWeight: '800', color: colors.primary, fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 },
  modalHint: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  modalPreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  modalPreviewLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D8DCE6',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, alignItems: 'center' },
  modalGhostBtn: { paddingVertical: 12, paddingHorizontal: spacing.md },
  modalGhostTxt: { fontSize: 16, fontWeight: '700', color: colors.primary },
  modalPrimaryOuter: {
    borderRadius: radius.button,
    overflow: 'hidden',
    minWidth: 100,
  },
  modalPrimaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  modalPrimaryDisabled: { opacity: 0.6 },
  modalPrimaryTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
