/**
 * Admin — create, edit, archive, and delete meet types (catalog, admin, and user-owned).
 */
import { AdminMeetTypesSkeleton } from '@/components/admin/AdminMeetTypesSkeleton';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  adminApproveMeetType,
  adminCreateMeetType,
  adminDeleteMeetType,
  adminRejectMeetType,
  adminSetMeetTypeActive,
  adminUpdateMeetType,
  fetchAllMeetTypesAdmin,
  isAdminCatalogMeetType,
  isUserCreatedMeetType,
  meetTypeOriginLabel,
  nextAdminMeetTypeSortOrder,
  type AdminMeetTypeInput,
  type AdminMeetTypeRow,
} from '@/lib/plans/adminMeetTypeCrud';
import { subscribeAdminMeetTypesRealtime } from '@/lib/plans/subscribeAdminMeetTypesRealtime';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbMeetType } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

type StatusFilter = 'all' | 'active' | 'inactive';
type FormMode = 'create' | 'edit';

type FormState = {
  name: string;
  slug: string;
  description: string;
  meet_type_images: string;
  default_duration_minutes: string;
  is_active: boolean;
  supports_mood: boolean;
  is_restricted: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  description: '',
  meet_type_images: '',
  default_duration_minutes: '120',
  is_active: true,
  supports_mood: false,
  is_restricted: false,
};

function formFromType(type: DbMeetType): FormState {
  return {
    name: type.name,
    slug: type.slug,
    description: type.description ?? '',
    meet_type_images: type.meet_type_images ?? '',
    default_duration_minutes: String(type.default_duration_minutes),
    is_active: type.is_active,
    supports_mood: type.supports_mood,
    is_restricted: type.is_restricted,
  };
}

function formToInput(form: FormState, options?: { sortOrder?: number }): AdminMeetTypeInput {
  const duration = parseInt(form.default_duration_minutes, 10);
  return {
    name: form.name,
    slug: form.slug.trim() || undefined,
    description: form.description.trim() || null,
    meet_type_images: form.meet_type_images.trim() || null,
    default_duration_minutes: Number.isFinite(duration) ? duration : 120,
    sort_order: options?.sortOrder,
    is_active: form.is_active,
    supports_mood: form.supports_mood,
    is_restricted: form.is_restricted,
    default_pattern: 'A',
  };
}

export function AdminMeetTypesPanel({
  refreshing = false,
  registerReload,
}: {
  refreshing?: boolean;
  registerReload?: (reload: (() => Promise<void>) | null) => void;
} = {}) {
  const [rows, setRows] = useState<AdminMeetTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editing, setEditing] = useState<DbMeetType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbMeetType | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [approveBusyId, setApproveBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminMeetTypeRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!isSupabaseConfigured) return;
    if (!options?.silent) setLoading(true);
    const { rows: data, error } = await fetchAllMeetTypesAdmin(supabase);
    if (error) Alert.alert('Meet types', error);
    setRows(data);
    if (!options?.silent) setLoading(false);
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    registerReload?.(() => load({ silent: true }));
    return () => registerReload?.(null);
  }, [load, registerReload]);

  useEffect(() => {
    return subscribeAdminMeetTypesRealtime(() => {
      void loadRef.current({ silent: true });
    });
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (statusFilter === 'active' && (!t.is_active || t.approval_status === 'pending')) return false;
      if (statusFilter === 'inactive' && (t.is_active || t.approval_status === 'pending')) return false;
      if (!needle) return true;
      const creator = t.creator_display_name?.trim() ?? '';
      const blob = `${t.name} ${t.slug} ${t.description ?? ''} ${creator}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q, statusFilter]);

  const pendingUserTypes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (!isUserCreatedMeetType(t) || t.approval_status !== 'pending') return false;
      if (!needle) return true;
      const creator = t.creator_display_name?.trim() ?? '';
      const blob = `${t.name} ${t.slug} ${t.description ?? ''} ${creator}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q]);

  const { catalogRows, userRows } = useMemo(
    () => ({
      catalogRows: filtered.filter((t) => isAdminCatalogMeetType(t)),
      userRows: filtered.filter((t) => isUserCreatedMeetType(t) && t.approval_status !== 'pending'),
    }),
    [filtered]
  );

  function openCreate() {
    setFormMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(type: DbMeetType) {
    setFormMode('edit');
    setEditing(type);
    setForm(formFromType(type));
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function onSaveForm() {
    if (!form.name.trim()) {
      Alert.alert('Meet type', 'Name is required.');
      return;
    }
    setSaving(true);
    const input =
      formMode === 'create'
        ? formToInput(form, { sortOrder: nextAdminMeetTypeSortOrder(rows) })
        : formToInput(form);

    if (formMode === 'create') {
      const { row, error } = await adminCreateMeetType(supabase, input);
      setSaving(false);
      if (error || !row) {
        Alert.alert('Create failed', error ?? 'Unknown error');
        return;
      }
      closeForm();
      await load({ silent: true });
      return;
    }

    if (!editing) {
      setSaving(false);
      return;
    }

    const { row, error } = await adminUpdateMeetType(supabase, editing.id, input);
    setSaving(false);
    if (error || !row) {
      Alert.alert('Update failed', error ?? 'Unknown error');
      return;
    }
    closeForm();
    await load({ silent: true });
  }

  async function onToggleActive(type: DbMeetType, next: boolean) {
    setToggleBusyId(type.id);
    const { error } = await adminSetMeetTypeActive(supabase, type.id, next);
    setToggleBusyId(null);
    if (error) {
      Alert.alert('Update failed', error);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === type.id ? { ...r, is_active: next } : r)));
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    const res = await adminDeleteMeetType(supabase, target.id);
    setDeleteBusy(false);
    setDeleteTarget(null);

    if (res.error) {
      Alert.alert('Delete failed', res.error);
      return;
    }
    if (res.blockedByPlans) {
      Alert.alert(
        'Cannot delete',
        `${target.name} is used by ${res.planCount ?? 1} plan(s). Archive it instead by turning Active off.`
      );
      return;
    }
    await load({ silent: true });
  }

  async function onApproveMeetType(type: AdminMeetTypeRow) {
    if (!type.created_by) return;
    setApproveBusyId(type.id);
    const { error } = await adminApproveMeetType(supabase, type.id, type.name, type.created_by);
    setApproveBusyId(null);
    if (error) {
      Alert.alert('Approve failed', error);
      return;
    }
    await load({ silent: true });
  }

  function openRejectModal(type: AdminMeetTypeRow) {
    setRejectTarget(type);
    setRejectReason('');
  }

  async function onConfirmReject() {
    const creatorId = rejectTarget?.created_by;
    if (!rejectTarget || !creatorId) return;
    const target = rejectTarget;
    setRejectBusy(true);
    const { error } = await adminRejectMeetType(
      supabase,
      target.id,
      target.name,
      creatorId,
      rejectReason.trim() || null
    );
    setRejectBusy(false);
    setRejectTarget(null);
    setRejectReason('');
    if (error) {
      Alert.alert('Reject failed', error);
      return;
    }
    await load({ silent: true });
  }

  const hasListContent = catalogRows.length > 0 || userRows.length > 0 || pendingUserTypes.length > 0;
  const showSkeleton = refreshing || (loading && rows.length === 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Search name, slug, description…"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
          {...Platform.select({
            android: { textAlignVertical: 'center' as const },
            default: {},
          })}
        />
        <Pressable onPress={openCreate} style={({ pressed }) => [styles.createBtn, pressed && styles.btnPressed]}>
          <LinearGradient colors={[...APP_CTA_GRADIENT]} style={styles.createBtnGrad}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createBtnTxt}>New</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'active', 'inactive'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setStatusFilter(key)}
            style={({ pressed }) => [
              styles.filterChip,
              statusFilter === key && styles.filterChipOn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={[styles.filterChipTxt, statusFilter === key && styles.filterChipTxtOn]}>
              {key === 'all' ? 'All' : key === 'active' ? 'Active' : 'Archived'}
            </Text>
          </Pressable>
        ))}
      </View>

      {showSkeleton ? (
        <AdminMeetTypesSkeleton count={6} />
      ) : !hasListContent ? (
        <Text style={styles.empty}>No meet types match your filters.</Text>
      ) : (
        <View style={styles.sections}>
          {pendingUserTypes.length > 0 ? (
            <View style={styles.pendingSection}>
              <View style={styles.pendingSectionHeader}>
                <Text style={styles.pendingSectionTitle}>Pending approval</Text>
                <View style={styles.pendingCountBadge}>
                  <Text style={styles.pendingCountText}>{pendingUserTypes.length}</Text>
                </View>
              </View>
              <Text style={styles.pendingSectionSubtitle}>
                Member-submitted meet types awaiting review.
              </Text>
              {pendingUserTypes.map((item) => (
                <MeetTypePendingApprovalRow
                  key={item.id}
                  item={item}
                  busy={approveBusyId === item.id || rejectBusy}
                  onApprove={() => void onApproveMeetType(item)}
                  onReject={() => openRejectModal(item)}
                />
              ))}
            </View>
          ) : null}
          <MeetTypeSection
            title="Admin & catalog"
            subtitle="Seed defaults and admin-managed types visible to all members."
            items={catalogRows}
            emptyLabel="No admin or catalog meet types match your filters."
            toggleBusyId={toggleBusyId}
            onToggleActive={onToggleActive}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
          <MeetTypeSection
            title="User-created"
            subtitle="Custom meet types owned by members."
            items={userRows}
            emptyLabel="No user-created meet types match your filters."
            showCreator
            toggleBusyId={toggleBusyId}
            onToggleActive={onToggleActive}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </View>
      )}

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={closeForm}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <KeyboardAwareScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>
                {formMode === 'create' ? 'Create meet type' : `Edit ${editing?.name ?? 'meet type'}`}
              </Text>
              {formMode === 'create' ? (
                <Text style={styles.modalHint}>
                  Admin-created types appear in the catalog for all users and cannot be edited by non-admins.
                </Text>
              ) : null}

              <Field label="Name" value={form.name} onChange={(name) => setForm((f) => ({ ...f, name }))} />
              <Field
                label="Slug"
                value={form.slug}
                onChange={(slug) => setForm((f) => ({ ...f, slug }))}
                placeholder="auto from name if empty on create"
              />
              <Field
                label="Description"
                value={form.description}
                onChange={(description) => setForm((f) => ({ ...f, description }))}
                multiline
              />
              <Field
                label="Cover image URL"
                value={form.meet_type_images}
                onChange={(meet_type_images) => setForm((f) => ({ ...f, meet_type_images }))}
                placeholder="Optional Storage URL"
              />
              <Field
                label="Duration (minutes)"
                value={form.default_duration_minutes}
                onChange={(default_duration_minutes) => setForm((f) => ({ ...f, default_duration_minutes }))}
                keyboardType="number-pad"
              />

              <ToggleRow
                label="Active"
                value={form.is_active}
                onChange={(is_active) => setForm((f) => ({ ...f, is_active }))}
              />
              <ToggleRow
                label="Supports mood plans"
                value={form.supports_mood}
                onChange={(supports_mood) => setForm((f) => ({ ...f, supports_mood }))}
              />
              <ToggleRow
                label="Restricted"
                value={form.is_restricted}
                onChange={(is_restricted) => setForm((f) => ({ ...f, is_restricted }))}
              />

              <View style={styles.modalActions}>
                <Pressable onPress={closeForm} style={({ pressed }) => [styles.modalSecondary, pressed && styles.btnPressed]}>
                  <Text style={styles.modalSecondaryTxt}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={saving}
                  onPress={() => void onSaveForm()}
                  style={({ pressed }) => [styles.modalPrimary, pressed && !saving && styles.btnPressed]}
                >
                  <LinearGradient colors={[...APP_CTA_GRADIENT]} style={styles.modalPrimaryGrad}>
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalPrimaryTxt}>{formMode === 'create' ? 'Create' : 'Save'}</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AppConfirmModal
        visible={deleteTarget != null}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        kicker="Meet types"
        title="Delete meet type?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed. If any plans use it, delete is blocked — archive instead.`
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

      <Modal
        visible={rejectTarget != null}
        animationType="fade"
        transparent
        onRequestClose={() => !rejectBusy && setRejectTarget(null)}
      >
        <Pressable
          style={styles.rejectOverlay}
          onPress={() => !rejectBusy && setRejectTarget(null)}
        >
          <Pressable style={styles.rejectCardHit} onPress={(e) => e.stopPropagation()}>
            <View style={styles.rejectCard}>
              <Text style={styles.rejectKicker}>Meet types</Text>
              <Text style={styles.rejectTitle}>Reject meet type?</Text>
              <Text style={styles.rejectMessage}>
                {rejectTarget
                  ? `"${rejectTarget.name}" will not be available to the member. You can add an optional reason below.`
                  : ''}
              </Text>
              <Text style={styles.fieldLbl}>Reason (optional)</Text>
              <TextInput
                style={styles.rejectInput}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Why this type wasn't approved"
                placeholderTextColor={colors.textMuted}
                multiline
                editable={!rejectBusy}
              />
              <View style={styles.rejectActions}>
                <Pressable
                  disabled={rejectBusy}
                  onPress={() => !rejectBusy && setRejectTarget(null)}
                  style={({ pressed }) => [styles.rejectCancelBtn, pressed && !rejectBusy && styles.btnPressed]}
                >
                  <Text style={styles.rejectCancelTxt}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={rejectBusy}
                  onPress={() => void onConfirmReject()}
                  style={({ pressed }) => [styles.rejectConfirmBtn, pressed && !rejectBusy && styles.btnPressed]}
                >
                  {rejectBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.rejectConfirmTxt}>Reject</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MeetTypePendingApprovalRow({
  item,
  busy,
  onApprove,
  onReject,
}: {
  item: AdminMeetTypeRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const creatorName = item.creator_display_name?.trim() || 'Unknown member';

  return (
    <View style={styles.pendingRow}>
      <View style={styles.rowMain}>
        <Text style={styles.creatorName}>{creatorName}</Text>
        <View style={styles.rowTitleRow}>
          <Ionicons name="time-outline" size={18} color="#B45309" />
          <Text style={styles.rowTitle}>{item.name}</Text>
        </View>
        <Text style={styles.rowSlug} numberOfLines={1}>
          {item.slug}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles.badgePending]}>
            <Text style={[styles.badgeTxt, styles.badgePendingTxt]}>Pending</Text>
          </View>
        </View>
      </View>
      <View style={styles.pendingRowActions}>
        <Pressable
          disabled={busy}
          onPress={onReject}
          style={({ pressed }) => [styles.pendingActionSecondary, pressed && !busy && styles.btnPressed]}
        >
          <Text style={styles.pendingActionSecondaryTxt}>Reject</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={onApprove}
          style={({ pressed }) => [styles.pendingActionPrimary, pressed && !busy && styles.btnPressed]}
        >
          <LinearGradient colors={[...APP_CTA_GRADIENT]} style={styles.pendingActionPrimaryGrad}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.pendingActionPrimaryTxt}>Approve</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function MeetTypeSection({
  title,
  subtitle,
  items,
  emptyLabel,
  showCreator = false,
  toggleBusyId,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  items: AdminMeetTypeRow[];
  emptyLabel: string;
  showCreator?: boolean;
  toggleBusyId: string | null;
  onToggleActive: (type: DbMeetType, next: boolean) => void;
  onEdit: (type: DbMeetType) => void;
  onDelete: (type: DbMeetType) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        <Text style={styles.sectionCount}>
          {items.length} {items.length === 1 ? 'type' : 'types'}
        </Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.sectionEmpty}>{emptyLabel}</Text>
      ) : (
        items.map((item) => (
          <MeetTypeAdminRow
            key={item.id}
            item={item}
            showCreator={showCreator}
            toggleBusyId={toggleBusyId}
            onToggleActive={onToggleActive}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </View>
  );
}

function MeetTypeAdminRow({
  item,
  showCreator,
  toggleBusyId,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  item: AdminMeetTypeRow;
  showCreator: boolean;
  toggleBusyId: string | null;
  onToggleActive: (type: DbMeetType, next: boolean) => void;
  onEdit: (type: DbMeetType) => void;
  onDelete: (type: DbMeetType) => void;
}) {
  const creatorName = item.creator_display_name?.trim() || 'Unknown member';

  return (
    <View style={[styles.row, !item.is_active && styles.rowInactive]}>
      <View style={styles.rowMain}>
        {showCreator ? (
          <Text style={styles.creatorName}>{creatorName}</Text>
        ) : null}
        <View style={styles.rowTitleRow}>
          <Ionicons
            name={(item.icon as keyof typeof Ionicons.glyphMap) ?? 'ellipse-outline'}
            size={18}
            color={item.is_active ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.rowTitle, !item.is_active && styles.rowTitleMuted]}>{item.name}</Text>
        </View>
        <Text style={styles.rowSlug} numberOfLines={1}>
          {item.slug}
        </Text>
        {item.description ? (
          <Text style={styles.rowDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{meetTypeOriginLabel(item)}</Text>
          </View>
          <View style={[styles.badge, item.is_active ? styles.badgeActive : styles.badgeArchived]}>
            <Text style={[styles.badgeTxt, item.is_active ? styles.badgeActiveTxt : styles.badgeArchivedTxt]}>
              {item.approval_status === 'rejected'
                ? 'Rejected'
                : item.is_active
                  ? 'Active'
                  : 'Archived'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.rowActions}>
        <View style={styles.activeRow}>
          <Text style={styles.activeLbl}>Active</Text>
          <Switch
            value={item.is_active}
            disabled={toggleBusyId === item.id}
            onValueChange={(v) => void onToggleActive(item, v)}
            trackColor={{ false: colors.border, true: 'rgba(94, 82, 255,0.45)' }}
            thumbColor={item.is_active ? colors.primary : '#f4f4f5'}
          />
        </View>
        <Pressable
          onPress={() => onEdit(item)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
          accessibilityLabel={`Edit ${item.name}`}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(item)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
          accessibilityLabel={`Delete ${item.name}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLbl}>{label}</Text>
      <TextInput
        style={[styles.inp, multiline && styles.inpMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLbl}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: 'rgba(94, 82, 255,0.45)' }}
        thumbColor={value ? colors.primary : '#f4f4f5'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  toolbar: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginBottom: spacing.sm },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    minHeight: 48,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  createBtn: {
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 48,
    alignSelf: 'stretch',
  },
  createBtnGrad: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
  },
  createBtnTxt: { fontSize: 14, fontWeight: '800', fontFamily: fonts.bold, color: '#fff' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipOn: { borderColor: colors.primary, backgroundColor: 'rgba(94, 82, 255,0.1)' },
  filterChipTxt: { fontSize: 13, fontWeight: '700', fontFamily: fonts.medium, color: colors.textMuted },
  filterChipTxtOn: { color: colors.primary },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg, fontFamily: fonts.medium },
  sections: { gap: spacing.lg },
  section: { marginBottom: spacing.sm },
  sectionHeader: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(94, 82, 255, 0.15)',
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', fontFamily: fonts.bold, color: colors.text },
  sectionSubtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 4, fontFamily: fonts.medium },
  sectionCount: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  pendingSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  pendingSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  pendingSectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
    fontFamily: fonts.medium,
  },
  pendingCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
  },
  pendingCountText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  pendingRow: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.2)',
    gap: spacing.sm,
  },
  pendingRowActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  pendingActionSecondary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  pendingActionSecondaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.danger,
  },
  pendingActionPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  pendingActionPrimaryGrad: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pendingActionPrimaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  badgePending: { backgroundColor: 'rgba(245,158,11,0.15)' },
  badgePendingTxt: { color: '#B45309' },
  rejectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.55)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  rejectCardHit: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  rejectCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  rejectKicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  rejectTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  rejectMessage: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
    fontFamily: fonts.medium,
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  rejectActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rejectCancelBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rejectCancelTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  rejectConfirmBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.danger,
  },
  rejectConfirmTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  creatorName: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  rowInactive: { opacity: 0.82, backgroundColor: '#F8F9FC' },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  rowTitle: { fontSize: 16, fontWeight: '800', fontFamily: fonts.bold, color: colors.text, flex: 1 },
  rowTitleMuted: { color: colors.textMuted },
  rowSlug: { fontSize: 12, fontWeight: '600', color: colors.textMuted, fontFamily: fonts.medium, marginBottom: 4 },
  rowDesc: { fontSize: 13, lineHeight: 18, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255,0.08)',
  },
  badgeActive: { backgroundColor: 'rgba(16,185,129,0.12)' },
  badgeArchived: { backgroundColor: 'rgba(107,114,128,0.1)' },
  badgeTxt: { fontSize: 10, fontWeight: '800', fontFamily: fonts.bold, color: colors.primary, textTransform: 'uppercase' },
  badgeActiveTxt: { color: '#047857' },
  badgeArchivedTxt: { color: colors.textMuted },
  rowActions: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeLbl: { fontSize: 11, fontWeight: '700', color: colors.textMuted, fontFamily: fonts.medium },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnPressed: { opacity: 0.9 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalScroll: {
    paddingBottom: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  modalHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md, fontFamily: fonts.medium },
  fieldWrap: { marginBottom: spacing.sm },
  fieldLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: fonts.bold,
  },
  inp: {
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inpMultiline: { minHeight: 88 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  toggleLbl: { fontSize: 15, fontWeight: '700', fontFamily: fonts.medium, color: colors.text },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  modalSecondary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSecondaryTxt: { fontSize: 15, fontWeight: '800', fontFamily: fonts.bold, color: colors.text },
  modalPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  modalPrimaryGrad: {
    minHeight: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalPrimaryTxt: { fontSize: 15, fontWeight: '800', fontFamily: fonts.bold, color: '#fff' },
});
