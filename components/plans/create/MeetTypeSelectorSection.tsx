/**
 * Step 1 — meet type catalog + custom type modal (create / edit / delete user-owned).
 */
import { GroupPlanSettingsSection } from '@/components/plans/create/GroupPlanSettingsSection';
import { MoodPlanFieldsSection } from '@/components/plans/create/MoodPlanFieldsSection';
import { MeetTypeFormModal } from '@/components/plans/create/MeetTypeFormModal';
import { MeetTypeReviewPendingModal } from '@/components/plans/create/MeetTypeReviewPendingModal';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanDraft } from '@/contexts/PlanDraftContext';
import { checkPermission } from '@/lib/subscription/checkPermission';
import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { insertUserMeetType } from '@/lib/plans/insertUserMeetType';
import {
  fetchMeetTypesForUser,
  filterMeetTypesVisibleToUser,
  isMeetTypePendingForUser,
  isMeetTypeSelectable,
} from '@/lib/plans/meetTypes';
import {
  deleteUserMeetType,
  isUserMeetType,
  updateUserMeetType,
} from '@/lib/plans/userMeetTypeCrud';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbMeetType, EscrowPattern } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type FormMode = 'create' | 'edit';
type PendingModalMode = 'submitted' | 'pending';

export function MeetTypeSelectorSection() {
  const { draft, setDraft } = usePlanDraft();
  const { user, isAdmin } = useAuth();
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
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingModalType, setPendingModalType] = useState<DbMeetType | null>(null);
  const [pendingModalMode, setPendingModalMode] = useState<PendingModalMode>('pending');
  const [groupUpgradeOpen, setGroupUpgradeOpen] = useState(false);

  function showFeedback(variant: AppFeedbackVariant, title: string, message: string) {
    setFeedback({ variant, title, message });
  }

  const reloadTypes = async () => {
    const { rows } = await fetchMeetTypesForUser(user?.id);
    setTypes(filterMeetTypesVisibleToUser(rows, user?.id));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { rows } = await fetchMeetTypesForUser(user?.id);
      const visible = filterMeetTypesVisibleToUser(rows, user?.id);
      if (cancelled) return;
      setTypes(visible);
      setLoading(false);
      setDraft((d) => {
        const current = visible.find((t) => t.id === d.meetTypeId);
        if (current && isMeetTypeSelectable(current)) return d;
        if (d.meetTypeId && current && !isMeetTypeSelectable(current)) {
          const fallback = firstSelectableType(visible);
          if (!fallback) return { ...d, meetTypeId: null };
          return {
            ...d,
            meetTypeId: fallback.id,
            durationMinutes: fallback.default_duration_minutes,
            escrowPattern: (fallback.default_pattern as EscrowPattern) ?? 'A',
          };
        }
        if (d.meetTypeId || visible.length === 0) return d;
        const dinner = firstSelectableType(visible);
        if (!dinner) return d;
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
  }, [setDraft, user?.id]);

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
    if (!isMeetTypeSelectable(t)) return;
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

  function firstSelectableType(rows: DbMeetType[]): DbMeetType | null {
    return (
      rows.find((t) => t.slug === 'dinner' && isMeetTypeSelectable(t)) ??
      rows.find((t) => isMeetTypeSelectable(t)) ??
      null
    );
  }

  function fallbackMeetTypeId(rows: DbMeetType[], excludeId?: string): string | null {
    const dinner = rows.find((t) => t.slug === 'dinner' && t.id !== excludeId && isMeetTypeSelectable(t));
    const first = rows.find((t) => t.id !== excludeId && isMeetTypeSelectable(t));
    return (dinner ?? first)?.id ?? null;
  }

  function openPendingModal(type: DbMeetType, mode: PendingModalMode) {
    setPendingModalType(type);
    setPendingModalMode(mode);
    setPendingModalOpen(true);
  }

  async function onSelectMeetType(t: DbMeetType) {
    if (isMeetTypePendingForUser(t, user?.id)) {
      openPendingModal(t, 'pending');
      return;
    }
    if (!isMeetTypeSelectable(t)) return;

    if (t.slug === 'group' && user?.id) {
      const perm = await checkPermission(user.id, 'group_plan.host');
      if (!perm.allowed) {
        setGroupUpgradeOpen(true);
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
      openPendingModal(row, 'submitted');
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
    if (draft.meetTypeId === row.id && isMeetTypeSelectable(row)) {
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
    const { rows } = await fetchMeetTypesForUser(user?.id);
    const visible = filterMeetTypesVisibleToUser(rows, user?.id);
    setTypes(visible);
    if (wasSelected) {
      const nextId = fallbackMeetTypeId(visible, target.id);
      if (nextId) {
        const next = visible.find((t) => t.id === nextId);
        if (next) applyMeetType(next);
        else setDraft((d) => ({ ...d, meetTypeId: nextId }));
      } else {
        setDraft((d) => ({ ...d, meetTypeId: null }));
      }
    }
  }

  const POPULAR_SLUGS = ['mood', 'dinner', 'dinner-date', 'casual', 'hangout', 'gym-buddy', 'gym'];
  const SOCIAL_SLUGS = [
    'group',
    'brunch-meet',
    'street-food',
    'cook-together-experience',
    'lounge-drinks',
    'live-event',
    'game-night',
    'run-club',
    'spa-wellness',
    'sports-companion',
  ];

  const popularTypes = types.filter((t) => POPULAR_SLUGS.includes(t.slug ?? ''));
  const socialTypes = types.filter((t) => SOCIAL_SLUGS.includes(t.slug ?? ''));
  const extendedTypes = types.filter(
    (t) =>
      !POPULAR_SLUGS.includes(t.slug ?? '') &&
      !SOCIAL_SLUGS.includes(t.slug ?? '') &&
      !isUserMeetType(t, user?.id ?? '')
  );
  const customTypes = types.filter((t) => isUserMeetType(t, user?.id ?? ''));

  function escrowPatternLabel(pattern: string | null | undefined): string {
    if (pattern === 'A') return 'Host funds';
    if (pattern === 'B') return 'Split 50/50';
    if (pattern === 'C') return 'Guest funds';
    return '';
  }

  function durationLabel(minutes: number | null | undefined): string {
    if (!minutes) return '';
    if (minutes >= 60) return `${minutes / 60}h default`;
    return `${minutes}min default`;
  }

  function onLongPressCustomType(t: DbMeetType) {
    const options = ['Edit', 'Delete', 'Cancel'];
    const destructiveIndex = 1;
    const cancelIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: destructiveIndex,
          cancelButtonIndex: cancelIndex,
        },
        (idx) => {
          if (idx === 0) openEditForm(t);
          if (idx === 1) setDeleteTarget(t);
        }
      );
    } else {
      Alert.alert(t.name, undefined, [
        { text: 'Edit', onPress: () => openEditForm(t) },
        { text: 'Delete', style: 'destructive', onPress: () => setDeleteTarget(t) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Meet type</Text>
      <Text style={styles.hint}>Pick a vibe for your meetup.</Text>

      {popularTypes.length > 0 && (
        <MeetTypeRow
          label="Popular"
          types={popularTypes}
          draft={draft}
          userId={user?.id}
          isAdmin={!!isAdmin}
          onSelect={(t) => void onSelectMeetType(t)}
          onLongPress={onLongPressCustomType}
        />
      )}

      {socialTypes.length > 0 && (
        <MeetTypeRow
          label="Social & activities"
          types={socialTypes}
          draft={draft}
          userId={user?.id}
          isAdmin={!!isAdmin}
          onSelect={(t) => void onSelectMeetType(t)}
          onLongPress={onLongPressCustomType}
        />
      )}

      {extendedTypes.length > 0 && (
        <MeetTypeRow
          label="More"
          types={extendedTypes}
          draft={draft}
          userId={user?.id}
          isAdmin={!!isAdmin}
          onSelect={(t) => void onSelectMeetType(t)}
          onLongPress={onLongPressCustomType}
        />
      )}

      {customTypes.length > 0 && (
        <MeetTypeRow
          label="Your types"
          types={customTypes}
          draft={draft}
          userId={user?.id}
          isAdmin={!!isAdmin}
          onSelect={(t) => void onSelectMeetType(t)}
          onLongPress={onLongPressCustomType}
        />
      )}

      {selectedType && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedIconWrap}>
            <Ionicons
              name={(selectedType.icon as keyof typeof Ionicons.glyphMap) ?? 'ellipse-outline'}
              size={22}
              color={colors.primary}
            />
          </View>
          <View style={styles.selectedCardBody}>
            <Text style={styles.selectedCardName} numberOfLines={1}>
              {selectedType.name}
            </Text>
            <View style={styles.selectedCardMeta}>
              {durationLabel(selectedType.default_duration_minutes) ? (
                <Text style={styles.selectedCardMetaText}>
                  {durationLabel(selectedType.default_duration_minutes)}
                </Text>
              ) : null}
              {escrowPatternLabel(selectedType.default_pattern) ? (
                <Text style={styles.selectedCardMetaText}>
                  {escrowPatternLabel(selectedType.default_pattern)}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        </View>
      )}

      {!isAdmin && (
        <Pressable
          onPress={openCreateForm}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add custom meet type"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addButtonText}>Add your own meet type</Text>
        </Pressable>
      )}

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

      <MeetTypeReviewPendingModal
        visible={pendingModalOpen}
        onClose={() => {
          setPendingModalOpen(false);
          setPendingModalType(null);
        }}
        meetTypeName={pendingModalType?.name ?? ''}
        mode={pendingModalMode}
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
        onPrimary={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
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
      <UpgradePrompt
        visible={groupUpgradeOpen}
        feature="group_plan.host"
        requiredTier="GOLD"
        title="Unlock group plans"
        message="Hosting group meetups is available on Gold and above."
        icon="people-outline"
        onUpgrade={() => {
          setGroupUpgradeOpen(false);
          router.push('/subscription' as Href);
        }}
        onDismiss={() => setGroupUpgradeOpen(false)}
      />
    </View>
  );
}

interface MeetTypeRowProps {
  label: string;
  types: DbMeetType[];
  draft: ReturnType<typeof usePlanDraft>['draft'];
  userId: string | undefined;
  isAdmin: boolean;
  onSelect: (t: DbMeetType) => void;
  onLongPress: (t: DbMeetType) => void;
}

function MeetTypeRow({
  label,
  types,
  draft,
  userId,
  isAdmin,
  onSelect,
  onLongPress,
}: MeetTypeRowProps) {
  return (
    <View style={rowStyles.wrap}>
      <Text style={rowStyles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={rowStyles.scrollContent}
      >
        {types.map((t) => {
          const pending = isMeetTypePendingForUser(t, userId);
          const selected = draft.meetTypeId === t.id && !pending;
          const owned = !!userId && isUserMeetType(t, userId) && !isAdmin;

          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t)}
              onLongPress={() => owned && !pending && onLongPress(t)}
              delayLongPress={400}
              style={({ pressed }) => [
                rowStyles.chip,
                selected && rowStyles.chipSelected,
                owned && !selected && rowStyles.chipOwned,
                pending && rowStyles.chipPending,
                pressed && !pending && rowStyles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t.name}
              accessibilityState={{ selected }}
            >
              <View style={[rowStyles.iconCircle, selected && rowStyles.iconCircleSelected]}>
                <Ionicons
                  name={(t.icon as keyof typeof Ionicons.glyphMap) ?? 'ellipse-outline'}
                  size={14}
                  color={selected ? '#fff' : colors.primary}
                />
              </View>

              <Text style={[rowStyles.chipText, selected && rowStyles.chipTextSelected]}>
                {t.name}
              </Text>

              {pending && (
                <View style={rowStyles.pendingBadge}>
                  <Text style={rowStyles.pendingBadgeText}>Pending</Text>
                </View>
              )}

              {owned && !selected && !pending && <View style={rowStyles.ownedDot} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipOwned: {
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: 'rgba(94,82,255,0.05)',
  },
  chipPending: {},
  chipPressed: {
    opacity: 0.8,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(94,82,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  chipTextSelected: {
    color: '#fff',
  },
  pendingBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ownedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.md,
    fontFamily: fonts.regular,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(94,82,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.15)',
    borderRadius: radius.button,
    padding: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  selectedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectedCardBody: {
    flex: 1,
    minWidth: 0,
  },
  selectedCardName: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  selectedCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  selectedCardMetaText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  selectedBadge: {
    backgroundColor: colors.primary,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    marginTop: spacing.xs,
    backgroundColor: 'rgba(94,82,255,0.04)',
  },
  addButtonPressed: {
    backgroundColor: 'rgba(94,82,255,0.10)',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
