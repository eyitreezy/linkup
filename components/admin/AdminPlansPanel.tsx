/**
 * Admin — browse and moderate plans (search, filters, archive, suppress, delete).
 */
import { KycNoticeModal } from '@/components/kyc/KycNoticeModal';
import { PlanShelfActionConfirmModal } from '@/components/plans/PlanShelfActionConfirmModal';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function PanelCard({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[panelStyles.card, style]}>
      <LinearGradient
        colors={[colors.secondary, colors.primary, '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={panelStyles.stripe}
      />
      <View style={panelStyles.body}>{children}</View>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: radius.lg, overflow: 'hidden' },
  stripe: { width: 4 },
  body: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
});

type PlanFilter = 'all' | 'mood' | 'expired' | 'suppressed';

type AdminPlanDialog = { action: 'archive' | 'delete'; id: string } | null;

function humanizeAdminPlanError(message: string): string {
  const m = message.trim();
  if (m.includes('meet_types') && m.toLowerCase().includes('row-level security')) {
    return (
      'The update failed while validating your plan\'s meet type on the server. That is usually fixed once the database ' +
      'runs the plan financial guard trigger with catalog access (migration trg_plans_financial_guard_bypass_meet_types_rls). ' +
      '\n\nDetail: ' +
      m
    );
  }
  return m;
}

function isPlanExpired(p: DbPlan): boolean {
  return (
    !!p.is_expired ||
    (!!p.is_mood_plan &&
      !!p.mood_expires_at &&
      new Date(p.mood_expires_at).getTime() <= Date.now())
  );
}

/** Extracted for bundle hygiene — used by `app/admin/index.tsx`. */
export function AdminPlansPanel() {
  const [rows, setRows] = useState<DbPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState<PlanFilter>('all');
  const [dialog, setDialog] = useState<AdminPlanDialog>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);
    if (error) {
      setNotice({
        title: 'Could not load plans',
        message: humanizeAdminPlanError(error.message),
      });
      setRows([]);
    } else setRows((data ?? []) as DbPlan[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (needle) {
        const blob = `${p.title} ${p.description ?? ''} ${p.location_label ?? ''}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }
      const exp = isPlanExpired(p);
      if (flt === 'mood' && !p.is_mood_plan) return false;
      if (flt === 'expired' && !exp) return false;
      if (flt === 'suppressed' && !p.is_suppressed) return false;
      return true;
    });
  }, [rows, q, flt]);

  async function archivePlanAdmin(id: string) {
    const { error } = await supabase
      .from('plans')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setNotice({
        title: 'Archive failed',
        message: humanizeAdminPlanError(error.message),
      });
      throw new Error(error.message);
    }
    void load();
  }

  async function unarchivePlanAdmin(id: string) {
    const { error } = await supabase.from('plans').update({ archived_at: null }).eq('id', id);
    if (error) {
      setNotice({
        title: 'Restore failed',
        message: humanizeAdminPlanError(error.message),
      });
      return;
    }
    void load();
  }

  async function deletePlanAdmin(id: string) {
    const { error } = await supabase.from('plans').delete().eq('id', id);
    if (error) {
      setNotice({
        title: 'Delete failed',
        message: humanizeAdminPlanError(error.message),
      });
      throw new Error(error.message);
    }
    void load();
  }

  async function toggleSuppress(id: string, on: boolean) {
    const { error } = await supabase.from('plans').update({ is_suppressed: on }).eq('id', id);
    if (error) {
      setNotice({
        title: 'Visibility did not update',
        message: humanizeAdminPlanError(error.message),
      });
      return;
    }
    void load();
  }

  const dialogProps =
    dialog?.action === 'archive'
      ? {
          title: 'Archive this plan?',
          message:
            'It will be hidden from public discovery like a creator archive. You can restore it from this panel anytime.',
          cancelLabel: 'Not now',
          confirmLabel: 'Archive plan',
          confirmVariant: 'neutral' as const,
        }
      : dialog?.action === 'delete'
        ? {
            title: 'Permanently delete this plan?',
            message:
              'Removes the plan row and may cascade related data depending on database rules. This cannot be undone.',
            cancelLabel: 'Keep plan',
            confirmLabel: 'Delete permanently',
            confirmVariant: 'danger' as const,
          }
        : null;

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
      <Text style={styles.head}>Plans workspace</Text>
      <Text style={styles.sub}>Search, filter, archive, hide from discover, or delete plans.</Text>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search title, body, location"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(
          [
            ['all', 'All'],
            ['mood', 'Mood'],
            ['expired', 'Expired'],
            ['suppressed', 'Hidden'],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setFlt(k)} style={[styles.chip, flt === k && styles.chipOn]}>
            <Text style={[styles.chipTxt, flt === k && styles.chipTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item: p }) => {
            const expired = isPlanExpired(p);
            return (
              <PanelCard style={{ marginBottom: spacing.sm }}>
                <Pressable onPress={() => router.push(`/plan/${p.id}` as Href)}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.cardMeta}>
                      {p.status}
                      {p.is_mood_plan ? ' · mood' : ''}
                      {p.archived_at != null ? ' · archived' : ''}
                      {p.is_suppressed ? ' · hidden' : ''}
                    </Text>
                    {expired ? (
                      <LinearGradient
                        colors={['#F97316', '#EF4444', '#A855F7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.expiredChip}
                      >
                        <Text style={styles.expiredChipTxt}>Expired</Text>
                      </LinearGradient>
                    ) : null}
                  </View>
                  <Text style={styles.mono} numberOfLines={1}>
                    {p.id}
                  </Text>
                </Pressable>
                <View style={styles.row}>
                  <Pressable style={styles.miniBtn} onPress={() => void toggleSuppress(p.id, !p.is_suppressed)}>
                    <Ionicons name="eye-off-outline" size={16} color={colors.primary} />
                    <Text style={styles.miniBtnTxt} numberOfLines={1}>
                      {p.is_suppressed ? 'Unhide' : 'Hide'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.miniBtn}
                    onPress={() => {
                      if (p.archived_at != null) void unarchivePlanAdmin(p.id);
                      else setDialog({ action: 'archive', id: p.id });
                    }}
                  >
                    <Ionicons
                      name={p.archived_at != null ? 'arrow-undo-outline' : 'archive-outline'}
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.miniBtnTxt} numberOfLines={1}>
                      {p.archived_at != null ? 'Restore' : 'Archive'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.miniBtn} onPress={() => setDialog({ action: 'delete', id: p.id })}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={styles.miniBtnTxtDanger} numberOfLines={1}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </PanelCard>
            );
          }}
        />
      )}
      <PlanShelfActionConfirmModal
        visible={dialog != null && dialogProps != null}
        onClose={() => setDialog(null)}
        title={dialogProps?.title ?? ''}
        message={dialogProps?.message ?? ''}
        cancelLabel={dialogProps?.cancelLabel ?? 'Cancel'}
        confirmLabel={dialogProps?.confirmLabel ?? 'Confirm'}
        confirmVariant={dialogProps?.confirmVariant ?? 'neutral'}
        onConfirm={async () => {
          if (!dialog) return;
          if (dialog.action === 'archive') await archivePlanAdmin(dialog.id);
          else await deletePlanAdmin(dialog.id);
        }}
      />
      <KycNoticeModal
        visible={notice != null}
        onClose={() => setNotice(null)}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chips: { gap: 8, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  chipOn: { backgroundColor: colors.primary },
  chipTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  chipTxtOn: { color: '#fff' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  cardMeta: { fontSize: 13, color: colors.textMuted, fontWeight: '600', flexShrink: 1 },
  expiredChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  expiredChipTxt: { fontSize: 11, fontWeight: '900', color: '#fff' },
  mono: { marginTop: 6, fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  row: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
    alignItems: 'stretch',
  },
  miniBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  miniBtnTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
  miniBtnTxtDanger: { fontSize: 13, fontWeight: '800', color: colors.danger },
});
