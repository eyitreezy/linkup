/**
 * Step 1 — meet type catalog + custom type modal (create / edit / delete user-owned).
 */
import { GroupPlanSettingsSection } from '@/components/plans/create/GroupPlanSettingsSection';
import { MoodPlanFieldsSection } from '@/components/plans/create/MoodPlanFieldsSection';
import { MeetTypeFormModal } from '@/components/plans/create/MeetTypeFormModal';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { GradientSelectionChip } from '@/components/ui/GradientSelectionChip';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { checkPermission } from '@/lib/subscription/checkPermission';
import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { insertUserMeetType } from '@/lib/plans/insertUserMeetType';
import { fetchActiveMeetTypes } from '@/lib/plans/meetTypes';
import {
  deleteUserMeetType,
  isUserMeetType,
  updateUserMeetType,
} from '@/lib/plans/userMeetTypeCrud';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbMeetType, EscrowPattern } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

type FormMode = 'create' | 'edit';

export function MeetTypeSelectorSection() {
  const { draft, setDraft } = usePlanDraft();
  const { user } = useAuth();
  const [types, setTypes] = useState<DbMeetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingType, setEditingType] = useState<DbMeetType | null>(null);
  const [typeName, setTypeName] = useState('');
  const [savingType, setSavingType] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbMeetType | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);

  function showFeedback(variant: AppFeedbackVariant, title: string, message: string) {
    setFeedback({ variant, title, message });
  }

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
    if (selectedType?.slug !== 'mood' && draft.isMoodPlan) {
      setDraft((d) => ({ ...d, isMoodPlan: false, moodExpiresAt: null }));
    }
  }, [selectedType?.slug, draft.isMoodPlan, setDraft]);

  const previewIcon = inferMeetTypeIcon(typeName);

  function applyMeetType(t: DbMeetType) {
    const isGroup = t.slug === 'group';
    setDraft((d) => ({
      ...d,
      meetTypeId: t.id,
      durationMinutes: t.default_duration_minutes,
      escrowPattern: (t.default_pattern as EscrowPattern) ?? d.escrowPattern ?? 'A',
      isMoodPlan: t.slug === 'mood' ? d.isMoodPlan : false,
      moodExpiresAt: t.slug === 'mood' ? d.moodExpiresAt : null,
      isGroupPlan: isGroup,
      multiCity: isGroup ? d.multiCity : false,
      cityIds: isGroup ? d.cityIds : [],
    }));
  }

  function fallbackMeetTypeId(rows: DbMeetType[], excludeId?: string): string | null {
    const dinner = rows.find((t) => t.slug === 'dinner' && t.id !== excludeId);
    const first = rows.find((t) => t.id !== excludeId);
    return (dinner ?? first)?.id ?? null;
  }

  async function onSelectMeetType(t: DbMeetType) {
    if (t.slug === 'group' && user?.id) {
      const perm = await checkPermission(user.id, 'group_plan.host');
      if (!perm.allowed) {
        Alert.alert(
          'Unlock group plans',
          'Hosting group meetups is available on Gold and above.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'View plans', onPress: () => router.push('/subscription' as Href) },
          ]
        );
        return;
      }
    }
    applyMeetType(t);
  }

  function openCreateForm() {
    setFormMode('create');
    setEditingType(null);
    setTypeName('');
    setFormOpen(true);
  }

  function openEditForm(t: DbMeetType) {
    setFormMode('edit');
    setEditingType(t);
    setTypeName(t.name);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingType(null);
    setTypeName('');
  }

  async function onSaveMeetType() {
    const name = typeName.trim();
    if (!user?.id || !isSupabaseConfigured) {
      showFeedback('warning', 'Sign in required', 'You need to be signed in to manage meet types.');
      return;
    }
    if (!name) {
      showFeedback('warning', 'Name required', 'Enter a short title for your meet type.');
      return;
    }

    setSavingType(true);

    if (formMode === 'create') {
      const { row, error } = await insertUserMeetType(supabase, user.id, name);
      setSavingType(false);
      if (error || !row) {
        showFeedback('error', 'Could not create type', error ?? 'Unknown error');
        return;
      }
      closeForm();
      await reloadTypes();
      setDraft((d) => ({
        ...d,
        meetTypeId: row.id,
        durationMinutes: row.default_duration_minutes,
        escrowPattern: (row.default_pattern as EscrowPattern) ?? d.escrowPattern ?? 'A',
        isMoodPlan: row.slug === 'mood' ? d.isMoodPlan : false,
        moodExpiresAt: row.slug === 'mood' ? d.moodExpiresAt : null,
      }));
      return;
    }

    if (!editingType) {
      setSavingType(false);
      return;
    }

    const { row, error } = await updateUserMeetType(supabase, user.id, editingType.id, name);
    setSavingType(false);
    if (error || !row) {
      showFeedback('error', 'Could not update type', error ?? 'Unknown error');
      return;
    }
    closeForm();
    await reloadTypes();
    if (draft.meetTypeId === row.id) {
      setDraft((d) => ({
        ...d,
        durationMinutes: row.default_duration_minutes,
        escrowPattern: (row.default_pattern as EscrowPattern) ?? d.escrowPattern ?? 'A',
      }));
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget || !user?.id) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    const res = await deleteUserMeetType(supabase, user.id, target.id);
    setDeleteBusy(false);
    setDeleteTarget(null);

    if (res.error) {
      showFeedback('error', 'Could not delete', res.error);
      return;
    }
    if (res.blockedByPlans) {
      const n = res.planCount ?? 1;
      showFeedback(
        'warning',
        "Can't delete meet type",
        n === 1
          ? 'This meet type is used by 1 plan. Remove or change that plan first, then try again.'
          : `This meet type is used by ${n} plans. Remove or change those plans first, then try again.`
      );
      return;
    }

    const wasSelected = draft.meetTypeId === target.id;
    const { rows } = await fetchActiveMeetTypes();
    setTypes(rows);
    if (wasSelected) {
      const nextId = fallbackMeetTypeId(rows, target.id);
      if (nextId) {
        const next = rows.find((t) => t.id === nextId);
        if (next) applyMeetType(next);
        else setDraft((d) => ({ ...d, meetTypeId: nextId }));
      } else {
        setDraft((d) => ({ ...d, meetTypeId: null }));
      }
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Meet type</Text>
      <Text style={styles.hint}>Pick a vibe or add your own — edit or remove types you created.</Text>
      <View style={styles.chipRow}>
        {types.map((t) => {
          const on = draft.meetTypeId === t.id;
          const owned = !!user?.id && isUserMeetType(t, user.id);
          return (
            <View key={t.id} style={styles.chipWrap}>
              <GradientSelectionChip selected={on} onPress={() => void onSelectMeetType(t)}>
                <View style={styles.typeChipInner}>
                  <Ionicons
                    name={(t.icon as keyof typeof Ionicons.glyphMap) ?? 'ellipse-outline'}
                    size={16}
                    color={on ? '#fff' : colors.primary}
                  />
                  <Text style={[styles.typeChipTxt, on && styles.typeChipTxtOn]}>{t.name}</Text>
                </View>
              </GradientSelectionChip>
              {owned ? (
                <View style={styles.chipActions}>
                  <Pressable
                    onPress={() => openEditForm(t)}
                    style={({ pressed }) => [styles.chipActionBtn, pressed && styles.chipActionPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${t.name}`}
                    hitSlop={4}
                  >
                    <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleteTarget(t)}
                    style={({ pressed }) => [styles.chipActionBtn, pressed && styles.chipActionPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${t.name}`}
                    hitSlop={4}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
        <Pressable
          onPress={openCreateForm}
          style={styles.addChip}
          accessibilityRole="button"
          accessibilityLabel="Add custom meet type"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addChipTxt}>New</Text>
        </Pressable>
      </View>

      <MeetTypeFormModal
        visible={formOpen}
        mode={formMode}
        name={typeName}
        onChangeName={setTypeName}
        previewIcon={previewIcon}
        saving={savingType}
        onClose={closeForm}
        onSave={() => void onSaveMeetType()}
      />

      <AppConfirmModal
        visible={deleteTarget != null}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        kicker="Meet types"
        title="Delete meet type?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from your list. This only works if no plans use it.`
            : ''
        }
        iconVariant="danger"
        primaryLabel="Keep"
        onPrimary={() => !deleteBusy && setDeleteTarget(null)}
        secondaryLabel="Delete"
        onSecondary={() => void onConfirmDelete()}
        secondaryTone="danger"
        busyOn="secondary"
        dismissOnBackdrop={!deleteBusy}
      />

      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'warning'}
        kicker="Meet types"
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        primaryLabel="Got it"
        onPrimary={() => setFeedback(null)}
      />

      <MoodPlanFieldsSection visible={selectedType?.slug === 'mood'} />
      <GroupPlanSettingsSection visible={selectedType?.slug === 'group'} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chipActionBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  chipActionPressed: { opacity: 0.85 },
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
});
