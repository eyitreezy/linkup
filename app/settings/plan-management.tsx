/**
 * Creator hub — plans you’ve shared (all, active, mood, expired, drafts, archived).
 */
import {
  PlanManagementHeroSkeleton,
  PlanManagementListSkeleton,
} from '@/components/plans/PlanManagementSkeleton';
import { PlanShelfActionConfirmModal } from '@/components/plans/PlanShelfActionConfirmModal';
import { AppFeedbackModal, type AppFeedbackVariant } from '@/components/ui/AppFeedbackModal';
import { PlanCreatorEditSheet } from '@/components/plans/PlanCreatorEditSheet';
import { SettingsStickyShell } from '@/components/settings/SettingsStickyShell';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { distanceKm } from '@/lib/location';
import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import { getCreatorEditCapabilities } from '@/lib/plans/planCreatorEditPolicy';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbPlan, DbMeetType } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type PlanRow = DbPlan & { meet_types?: DbMeetType | null };
type Section = 'all' | 'active' | 'mood' | 'expired' | 'drafts' | 'archived';
type SortKey = 'newest' | 'oldest' | 'expiring';
type ShelfDialog = { kind: 'archive' | 'delete'; planId: string } | null;

function isMoodExpired(p: PlanRow): boolean {
  return (
    !!p.is_mood_plan &&
    (!!p.is_expired || (p.mood_expires_at != null && new Date(p.mood_expires_at).getTime() <= Date.now()))
  );
}

function planMatchesSection(p: PlanRow, section: Section): boolean {
  const archived = p.archived_at != null;
  const expiredMood = isMoodExpired(p);

  switch (section) {
    case 'all':
      return true;
    case 'active':
      return (
        !archived &&
        !expiredMood &&
        ['negotiating', 'active', 'agreed', 'awaiting_payment'].includes(p.status)
      );
    case 'mood':
      /** All mood plans (TTL ended or not); use Expired for mood-only ended shelf. */
      return !archived && !!p.is_mood_plan;
    case 'expired':
      return !archived && expiredMood;
    case 'drafts':
      return p.status === 'draft' && !archived;
    case 'archived':
      return archived;
    default:
      return true;
  }
}

function sortPlans(list: PlanRow[], sort: SortKey): PlanRow[] {
  const copy = [...list];
  if (sort === 'expiring') {
    copy.sort((a, b) => {
      const ta = a.mood_expires_at ? new Date(a.mood_expires_at).getTime() : Infinity;
      const tb = b.mood_expires_at ? new Date(b.mood_expires_at).getTime() : Infinity;
      return ta - tb;
    });
    return copy;
  }
  const dir = sort === 'oldest' ? 1 : -1;
  copy.sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  return copy;
}

type FilterChipProps = {
  label: string;
  active: boolean;
  count: number;
  onPress: () => void;
};

function SectionFilterChip({ label, active, count, onPress }: FilterChipProps) {
  return (
    <Pressable onPress={onPress} style={styles.chipOuter}>
      {active ? (
        <LinearGradient
          colors={[colors.primary, '#8B7CFF', colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chipGradient}
        >
          <Text style={styles.chipLabelOn}>{label}</Text>
          <View style={styles.chipBadgeOn}>
            <Text style={styles.chipBadgeTxtOn}>{count}</Text>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.chipIdle}>
          <Text style={styles.chipLabel}>{label}</Text>
          <View style={styles.chipBadge}>
            <Text style={styles.chipBadgeTxt}>{count}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.sortChipOuter}>
      {active ? (
        <LinearGradient
          colors={['rgba(108,99,255,0.95)', '#9B8CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sortChipGrad}
        >
          <Text style={styles.sortChipOnTxt}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.sortChipIdle}>
          <Text style={styles.sortChipTxt}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function PlanManagementScreen() {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [offersCountByPlan, setOffersCountByPlan] = useState<Record<string, number>>({});
  const [viewsByPlan, setViewsByPlan] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<Section>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [query, setQuery] = useState('');
  const [shelfDialog, setShelfDialog] = useState<ShelfDialog>(null);
  const [editPlan, setEditPlan] = useState<PlanRow | null>(null);
  const [feedback, setFeedback] = useState<{
    variant: AppFeedbackVariant;
    title: string;
    message: string;
  } | null>(null);

  function showFeedback(variant: AppFeedbackVariant, title: string, message: string) {
    setFeedback({ variant, title, message });
  }

  const userLat = profile?.latitude ?? null;
  const userLng = profile?.longitude ?? null;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    const { data, error } = await supabase
      .from('plans')
      .select('*, meet_types(*)')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      showFeedback('error', 'Could not load plans', error.message);
      setPlans([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as PlanRow[];
    setPlans(rows);
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      setOffersCountByPlan({});
      setViewsByPlan({});
      setLoading(false);
      return;
    }
    const [{ data: eng }, { data: offAgg }] = await Promise.all([
      supabase.from('plan_engagements').select('plan_id, kind').in('plan_id', ids),
      supabase.from('plan_offers').select('plan_id').in('plan_id', ids),
    ]);
    const views: Record<string, number> = {};
    for (const r of eng ?? []) {
      if ((r as { kind: string }).kind !== 'view') continue;
      const pid = (r as { plan_id: string }).plan_id;
      views[pid] = (views[pid] ?? 0) + 1;
    }
    const neg: Record<string, number> = {};
    for (const r of offAgg ?? []) {
      const pid = (r as { plan_id: string }).plan_id;
      neg[pid] = (neg[pid] ?? 0) + 1;
    }
    setViewsByPlan(views);
    setOffersCountByPlan(neg);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  const sectionCounts = useMemo(() => {
    const keys: Section[] = ['all', 'active', 'mood', 'expired', 'drafts', 'archived'];
    const out = {} as Record<Section, number>;
    for (const k of keys) {
      out[k] = plans.filter((p) => planMatchesSection(p, k)).length;
    }
    return out;
  }, [plans]);

  const activeLivingCount = useMemo(
    () => plans.filter((p) => planMatchesSection(p, 'active')).length,
    [plans]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = plans.filter((p) => {
      if (!planMatchesSection(p, section)) return false;
      if (!q) return true;
      const blob = [
        p.title,
        p.description,
        p.location_label,
        p.category,
        p.mood_type,
        p.meet_types?.name,
        p.meet_types?.slug,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
    return sortPlans(list, sort);
  }, [plans, query, section, sort]);

  async function archivePlan(id: string) {
    const { error } = await supabase.from('plans').update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      showFeedback('error', 'Archive failed', error.message);
      throw new Error(error.message);
    }
    void load();
  }

  async function unarchivePlan(id: string) {
    const { error } = await supabase.from('plans').update({ archived_at: null }).eq('id', id);
    if (error) showFeedback('error', 'Unarchive failed', error.message);
    else void load();
  }

  async function deleteDraftConfirmed(id: string) {
    const { error } = await supabase.from('plans').delete().eq('id', id).eq('status', 'draft');
    if (error) {
      showFeedback('error', 'Delete failed', error.message);
      throw new Error(error.message);
    }
    void load();
  }

  async function duplicatePlan(p: PlanRow) {
    if (!user?.id) return;
    const { data: newId, error } = await supabase.rpc('duplicate_plan_for_creator', {
      p_plan_id: p.id,
    });
    if (error) {
      showFeedback('error', 'Duplicate failed', error.message);
      return;
    }
    const id = typeof newId === 'string' ? newId : newId != null ? String(newId) : null;
    if (id) router.push(`/plan/${id}` as Href);
  }

  const sectionChips: { id: Section; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'mood', label: 'Mood' },
    { id: 'expired', label: 'Expired' },
    { id: 'drafts', label: 'Drafts' },
    { id: 'archived', label: 'Archived' },
  ];

  const emptyTitle =
    plans.length === 0 ? 'No meetups yet' : query.trim() ? 'No matches' : 'Nothing in this filter';
  const emptySub =
    plans.length === 0
      ? 'When you publish a plan, it shows up here — mood sparks and longer ideas together.'
      : query.trim()
        ? 'Try another keyword, clear search, or switch to All to browse everything you’ve created.'
        : 'Try the All tab to see every plan, or pick another shelf above.';

  return (
    <>
      <SettingsStickyShell
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />
        }
      >
          <View style={styles.headerRow}>
            <View style={styles.headerIconWrap}>
              <LinearGradient
                colors={[colors.primary, '#8B7CF8']}
                style={styles.headerIconGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="albums" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Your catalog</Text>
              <Text style={styles.title}>Plan management</Text>
            </View>
          </View>

          <Text style={styles.sub}>
            Color-coded shelves for every stage — same energy as your wallet: clear, confident, ready to scale.
          </Text>

          <LinearGradient
            colors={['#6C63FF', '#9B8CFF', '#FF6584']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroInner}>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>Plans in your name</Text>
                <View style={styles.heroLivePill}>
                  <View style={styles.heroLiveDot} />
                  <Text style={styles.heroLiveTxt}>Synced</Text>
                </View>
              </View>
              {loading ? (
                <PlanManagementHeroSkeleton />
              ) : (
                <>
                  <Text style={styles.heroStat}>{plans.length}</Text>
                  <Text style={styles.heroHint}>
                    {activeLivingCount} live in discovery flow · filters below slice this total without hiding the rest.
                  </Text>
                </>
              )}
            </View>
          </LinearGradient>

          <View style={styles.searchShell}>
            <Ionicons name="search-outline" size={22} color={colors.primary} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search title, place, mood, category…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterSectionLabelRow}>
            <Ionicons name="funnel-outline" size={16} color={colors.secondary} />
            <Text style={styles.filterSectionLabel}>Show</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {sectionChips.map((c) => (
              <SectionFilterChip
                key={c.id}
                label={c.label}
                active={section === c.id}
                count={sectionCounts[c.id]}
                onPress={() => setSection(c.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.filterSectionLabelRow}>
            <Ionicons name="swap-vertical-outline" size={16} color={colors.secondary} />
            <Text style={styles.filterSectionLabel}>Sort by</Text>
          </View>
          <View style={styles.sortRow}>
            <SortChip label="Newest" active={sort === 'newest'} onPress={() => setSort('newest')} />
            <SortChip label="Oldest" active={sort === 'oldest'} onPress={() => setSort('oldest')} />
            <SortChip label="Expiring" active={sort === 'expiring'} onPress={() => setSort('expiring')} />
          </View>

          {loading ? (
            <PlanManagementListSkeleton />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <LinearGradient
                colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.08)']}
                style={styles.emptyIconRing}
              >
                <Ionicons name="folder-open-outline" size={36} color={colors.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptySub}>{emptySub}</Text>
            </View>
          ) : (
            filtered.map((p) => {
              const dist =
                userLat != null && userLng != null && p.latitude != null && p.longitude != null
                  ? distanceKm(userLat, userLng, p.latitude, p.longitude)
                  : null;
              const neg = offersCountByPlan[p.id] ?? 0;
              const views = viewsByPlan[p.id] ?? 0;
              const moodLive = p.is_mood_plan && !isPlanMoodWindowClosed(p);
              const stripeStyle = p.archived_at
                ? styles.stripeArchived
                : p.status === 'draft'
                  ? styles.stripeDraft
                  : isMoodExpired(p)
                    ? styles.stripeExpired
                    : p.is_mood_plan
                      ? styles.stripeMood
                      : styles.stripeDefault;
              const capsNeg = getCreatorEditCapabilities(p, neg);
              return (
                <View key={p.id} style={styles.planCard}>
                  <View style={[styles.planStripe, stripeStyle]} />
                  <View style={styles.planBody}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {p.title}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {p.status}
                          {p.is_mood_plan ? ' · Mood' : ''}
                          {dist != null ? ` · ${Math.round(dist)} km` : ''}
                        </Text>
                      </View>
                      {moodLive && p.mood_expires_at ? (
                        <View style={styles.livePill}>
                          <Text style={styles.livePillTxt}>Live</Text>
                        </View>
                      ) : p.is_mood_plan && isMoodExpired(p) ? (
                        <View style={styles.endedPill}>
                          <Text style={styles.endedPillTxt}>Ended</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.statPill}>
                        <Ionicons name="eye-outline" size={15} color={colors.primary} />
                        <Text style={styles.statItem}>{views} views</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Ionicons name="chatbubbles-outline" size={15} color={colors.secondary} />
                        <Text style={styles.statItem}>{neg} offers</Text>
                      </View>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.actionsScroll}
                      contentContainerStyle={styles.actionsScrollInner}
                    >
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => router.push(`/plan/${p.id}` as Href)}
                      >
                        <Text style={styles.actionBtnTxt}>Open</Text>
                      </Pressable>
                      {capsNeg.canEdit ? (
                        <Pressable style={styles.actionBtn} onPress={() => setEditPlan(p)}>
                          <Text style={styles.actionBtnTxt}>Edit</Text>
                        </Pressable>
                      ) : null}
                      <Pressable style={styles.actionBtn} onPress={() => void duplicatePlan(p)}>
                        <Text style={styles.actionBtnTxt}>Duplicate</Text>
                      </Pressable>
                      {p.status !== 'draft' && !p.archived_at ? (
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => setShelfDialog({ kind: 'archive', planId: p.id })}
                        >
                          <Text style={styles.actionBtnTxt}>Archive</Text>
                        </Pressable>
                      ) : null}
                      {p.archived_at ? (
                        <Pressable style={styles.actionBtn} onPress={() => void unarchivePlan(p.id)}>
                          <Text style={styles.actionBtnTxt}>Restore</Text>
                        </Pressable>
                      ) : null}
                      {p.status === 'draft' ? (
                        <Pressable
                          style={styles.actionBtnDanger}
                          onPress={() => setShelfDialog({ kind: 'delete', planId: p.id })}
                        >
                          <Text style={styles.actionBtnDangerTxt}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </ScrollView>
                  </View>
                </View>
              );
            })
          )}
      </SettingsStickyShell>

      <PlanCreatorEditSheet
        visible={editPlan != null}
        plan={editPlan}
        offersCount={editPlan ? (offersCountByPlan[editPlan.id] ?? 0) : 0}
        onClose={() => setEditPlan(null)}
        onSaved={() => void load()}
      />

      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'error'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
      />

      <PlanShelfActionConfirmModal
        visible={shelfDialog != null}
        onClose={() => setShelfDialog(null)}
        title={shelfDialog?.kind === 'delete' ? 'Delete this draft?' : 'Archive this plan?'}
        message={
          shelfDialog?.kind === 'delete'
            ? 'This permanently removes the draft from your account. Published plans are not deleted here — archive those instead.'
            : 'It will leave active shelves and discovery. You can restore it anytime from the Archived tab.'
        }
        cancelLabel={shelfDialog?.kind === 'delete' ? 'Keep draft' : 'Not now'}
        confirmLabel={shelfDialog?.kind === 'delete' ? 'Delete draft' : 'Archive plan'}
        confirmVariant={shelfDialog?.kind === 'delete' ? 'danger' : 'neutral'}
        onConfirm={async () => {
          if (!shelfDialog) return;
          if (shelfDialog.kind === 'delete') await deleteDraftConfirmed(shelfDialog.planId);
          else await archivePlan(shelfDialog.planId);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2.5,
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  headerIconWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  headerIconGrad: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.6 },
  sub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.md, fontWeight: '600' },

  heroGradient: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  heroInner: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.xl - 2,
    padding: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  heroLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' },
  heroLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  heroLiveTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  heroStat: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: 4 },
  heroHint: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 10, lineHeight: 20, fontWeight: '600' },

  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    minHeight: 52,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: Platform.OS === 'android' ? 10 : 12 },

  filterSectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: spacing.md,
    flexWrap: 'nowrap',
  },
  chipOuter: { borderRadius: radius.button, overflow: 'hidden' },
  chipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  chipLabelOn: { fontSize: 13, fontWeight: '800', color: '#fff' },
  chipBadgeOn: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
  },
  chipBadgeTxtOn: { fontSize: 12, fontWeight: '900', color: '#fff' },
  chipIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  chipLabel: { fontSize: 13, fontWeight: '800', color: colors.primary },
  chipBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignItems: 'center',
  },
  chipBadgeTxt: { fontSize: 12, fontWeight: '900', color: colors.primary },

  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  sortChipOuter: { borderRadius: radius.button, overflow: 'hidden' },
  sortChipGrad: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.button },
  sortChipOnTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
  sortChipIdle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  sortChipTxt: { fontSize: 13, fontWeight: '800', color: colors.textMuted },

  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: spacing.md },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '600',
    maxWidth: 300,
  },

  planCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  planStripe: { width: 4 },
  stripeDefault: { backgroundColor: colors.primary },
  stripeMood: { backgroundColor: colors.secondary },
  stripeDraft: { backgroundColor: '#F59E0B' },
  stripeExpired: { backgroundColor: '#64748B' },
  stripeArchived: { backgroundColor: '#94A3B8' },
  planBody: { flex: 1, padding: spacing.md },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  livePill: {
    backgroundColor: 'rgba(255,101,132,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  livePillTxt: { fontSize: 11, fontWeight: '900', color: colors.secondary },
  endedPill: {
    backgroundColor: 'rgba(100,116,139,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  endedPillTxt: { fontSize: 11, fontWeight: '900', color: '#64748B' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(108,99,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  statItem: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  actionsScroll: { marginTop: spacing.md, marginHorizontal: -2 },
  actionsScrollInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.12)',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
  actionBtnDanger: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.35)',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDangerTxt: { fontSize: 13, fontWeight: '800', color: colors.danger },
});
