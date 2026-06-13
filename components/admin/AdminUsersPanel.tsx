/**
 * Admin — user directory: search, filter, sort, view/edit account + profile, suspend flow.
 */
import { KycNoticeModal } from '@/components/kyc/KycNoticeModal';
import { AdminGoodwillPanel } from '@/components/admin/AdminGoodwillPanel';
import { AdminTrialPanel } from '@/components/admin/AdminTrialPanel';
import { PlanShelfActionConfirmModal } from '@/components/plans/PlanShelfActionConfirmModal';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AccountStatus, DbProfile, DbUser, UserVerification } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const ACCOUNTS: AccountStatus[] = ['active', 'restricted', 'suspended', 'banned'];
const VERIFS: UserVerification[] = ['unverified', 'pending', 'verified', 'rejected'];

type ProfileRel = DbProfile | DbProfile[] | null;

export type AdminUserListRow = DbUser & {
  profiles: ProfileRel;
};

function oneProfile(p: ProfileRel): DbProfile | null {
  if (p == null) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

type AccountFilter = 'all' | 'active' | 'restricted' | 'suspended' | 'banned' | 'non_active';
type VerifFilter = 'all' | 'verified' | 'unverified';
type UserSort = 'newest' | 'oldest' | 'name_az' | 'name_za';

function UserStripeCard({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[cardStyles.wrap, style]}>
      <LinearGradient
        colors={[colors.secondary, colors.primary, '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={cardStyles.stripe}
      />
      <View style={cardStyles.body}>{children}</View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.lg, overflow: 'hidden' },
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

function statusPillStyle(kind: AccountStatus | UserVerification): { bg: string; fg: string; bd: string } {
  if (kind === 'banned' || kind === 'suspended') {
    return { bg: 'rgba(239,68,68,0.12)', fg: colors.danger, bd: 'rgba(239,68,68,0.28)' };
  }
  if (kind === 'restricted') {
    return { bg: 'rgba(245,158,11,0.15)', fg: '#B45309', bd: 'rgba(245,158,11,0.35)' };
  }
  if (kind === 'verified' || kind === 'active') {
    return { bg: 'rgba(16,185,129,0.12)', fg: '#047857', bd: 'rgba(16,185,129,0.3)' };
  }
  if (kind === 'pending') {
    return { bg: 'rgba(245,158,11,0.15)', fg: '#B45309', bd: 'rgba(245,158,11,0.3)' };
  }
  if (kind === 'rejected') {
    return { bg: 'rgba(239,68,68,0.1)', fg: colors.danger, bd: 'rgba(239,68,68,0.25)' };
  }
  return { bg: 'rgba(108,99,255,0.1)', fg: colors.primary, bd: 'rgba(108,99,255,0.22)' };
}

export function AdminUsersPanel() {
  const { user: authUser } = useAuth();
  const [rows, setRows] = useState<AdminUserListRow[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [accFlt, setAccFlt] = useState<AccountFilter>('all');
  const [verFlt, setVerFlt] = useState<VerifFilter>('all');
  const [sort, setSort] = useState<UserSort>('newest');
  const [edit, editSet] = useState<AdminUserListRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUserListRow | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const [{ data: usersData, error: uErr }, { data: admData }] = await Promise.all([
      supabase.from('users').select('*, profiles(*)').order('created_at', { ascending: false }).limit(300),
      supabase.from('admins').select('user_id'),
    ]);
    if (uErr) {
      setNotice({ title: 'Could not load users', message: uErr.message });
      setRows([]);
    } else {
      setRows((usersData ?? []) as AdminUserListRow[]);
    }
    setAdminIds(new Set((admData ?? []).map((r) => r.user_id as string)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = [...rows];
    if (needle) {
      list = list.filter((u) => {
        const pr = oneProfile(u.profiles);
        const blob = [
          u.email,
          u.id,
          pr?.display_name,
          pr?.bio,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(needle);
      });
    }
    if (accFlt !== 'all') {
      list = list.filter((u) => {
        if (accFlt === 'non_active') return u.account_status !== 'active';
        return u.account_status === accFlt;
      });
    }
    if (verFlt === 'verified') {
      list = list.filter((u) => u.verification_status === 'verified');
    } else if (verFlt === 'unverified') {
      list = list.filter((u) => u.verification_status !== 'verified');
    }
    list.sort((a, b) => {
      const pa = oneProfile(a.profiles);
      const pb = oneProfile(b.profiles);
      const na = (pa?.display_name ?? a.email ?? '').toLowerCase();
      const nb = (pb?.display_name ?? b.email ?? '').toLowerCase();
      switch (sort) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name_az':
          return na.localeCompare(nb);
        case 'name_za':
          return nb.localeCompare(na);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [rows, q, accFlt, verFlt, sort]);

  async function saveUserEdits(
    u: AdminUserListRow,
    patch: {
      account_status: AccountStatus;
      verification_status: UserVerification;
      boost_credits: number;
      display_name: string;
      bio: string;
      verified_badge: boolean;
      is_profile_public: boolean;
    }
  ) {
    setSaveBusy(true);
    const { error: uErr } = await supabase
      .from('users')
      .update({
        account_status: patch.account_status,
        verification_status: patch.verification_status,
        boost_credits: patch.boost_credits,
      })
      .eq('id', u.id);
    if (uErr) {
      setSaveBusy(false);
      setNotice({ title: 'Account update failed', message: uErr.message });
      return;
    }
    const pr = oneProfile(u.profiles);
    if (pr) {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          display_name: patch.display_name.trim() || null,
          bio: patch.bio.trim() || null,
          verified_badge: patch.verified_badge,
          is_profile_public: patch.is_profile_public,
        })
        .eq('user_id', u.id);
      if (pErr) {
        setSaveBusy(false);
        setNotice({ title: 'Profile update failed', message: pErr.message });
        return;
      }
    } else {
      const { error: insErr } = await supabase.from('profiles').insert({
        user_id: u.id,
        display_name: patch.display_name.trim() || null,
        bio: patch.bio.trim() || null,
        verified_badge: patch.verified_badge,
        is_profile_public: patch.is_profile_public,
        preferences: {},
      });
      if (insErr) {
        setSaveBusy(false);
        setNotice({
          title: 'Profile save failed',
          message:
            insErr.message +
            '\n\nIf this member has no profile row, apply the migration that grants admins profile insert.',
        });
        return;
      }
    }
    setSaveBusy(false);
    editSet(null);
    void load();
  }

  async function suspendUser(u: AdminUserListRow) {
    const { error } = await supabase.from('users').update({ account_status: 'suspended' }).eq('id', u.id);
    if (error) {
      setNotice({ title: 'Suspend failed', message: error.message });
      throw new Error(error.message);
    }
    void load();
  }

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
      <Text style={styles.head}>People & accounts</Text>
      <Text style={styles.sub}>
        Search, filter, and update trust signals. Suspension is reversible — hard deletes run outside the app.
      </Text>

      <View style={styles.searchShell}>
        <Ionicons name="search-outline" size={20} color={colors.primary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Name, email, or user id"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInp}
        />
        {q.length > 0 ? (
          <Pressable onPress={() => setQ('')} hitSlop={10}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.filterLabel}>Account</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(
          [
            ['all', 'All'],
            ['active', 'Active'],
            ['non_active', 'Needs review'],
            ['restricted', 'Restricted'],
            ['suspended', 'Suspended'],
            ['banned', 'Banned'],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setAccFlt(k)} style={[styles.chip, accFlt === k && styles.chipOn]}>
            <Text style={[styles.chipTxt, accFlt === k && styles.chipTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Verification</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(
          [
            ['all', 'All'],
            ['verified', 'Verified'],
            ['unverified', 'Not verified'],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setVerFlt(k)} style={[styles.chip, verFlt === k && styles.chipOn]}>
            <Text style={[styles.chipTxt, verFlt === k && styles.chipTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Sort</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(
          [
            ['newest', 'Newest'],
            ['oldest', 'Oldest'],
            ['name_az', 'Name A–Z'],
            ['name_za', 'Name Z–A'],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setSort(k)} style={[styles.chip, sort === k && styles.chipOn]}>
            <Text style={[styles.chipTxt, sort === k && styles.chipTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.countHint}>
        Showing {filtered.length} of {rows.length} loaded
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={filtered}
          scrollEnabled={false}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.primary} />
              <Text style={styles.emptyTitle}>No people match</Text>
              <Text style={styles.emptySub}>Try clearing search or widening filters.</Text>
            </View>
          }
          renderItem={({ item: u }) => {
            const pr = oneProfile(u.profiles);
            const isAdminUser = adminIds.has(u.id);
            const ast = statusPillStyle(u.account_status);
            const vst = statusPillStyle(u.verification_status);
            return (
              <UserStripeCard style={{ marginBottom: spacing.sm }}>
                <Pressable onPress={() => editSet(u)} style={styles.cardPress}>
                  <View style={styles.cardTop}>
                    <LinearGradient
                      colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.25)', '#34D39933']}
                      style={styles.avatarRing}
                    >
                      {pr?.avatar_url ? (
                        <Image source={{ uri: pr.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPh}>
                          <Ionicons name="person" size={28} color={colors.primary} />
                        </View>
                      )}
                    </LinearGradient>
                    <View style={styles.cardHeadText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {pr?.display_name?.trim() || 'Unnamed member'}
                      </Text>
                      <Text style={styles.email} numberOfLines={1}>
                        {u.email ?? u.id.slice(0, 12) + '…'}
                      </Text>
                    </View>
                    {isAdminUser ? (
                      <View style={styles.adminBadge}>
                        <Ionicons name="shield-checkmark" size={14} color="#fff" />
                        <Text style={styles.adminBadgeTxt}>Admin</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.pillRow}>
                    <View style={[styles.pill, { backgroundColor: ast.bg, borderColor: ast.bd }]}>
                      <Text style={[styles.pillTxt, { color: ast.fg }]}>{u.account_status}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: vst.bg, borderColor: vst.bd }]}>
                      <Text style={[styles.pillTxt, { color: vst.fg }]}>{u.verification_status}</Text>
                    </View>
                    {pr?.verified_badge ? (
                      <View style={[styles.pill, styles.pillHost]}>
                        <Text style={styles.pillHostTxt}>Verified host</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.metaRow}>
                    <EntypoTimeInline />
                    <Text style={styles.meta}>
                      Joined {new Date(u.created_at).toLocaleDateString()} · credits {u.boost_credits}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.rowActions}>
                  <Pressable style={styles.miniBtn} onPress={() => editSet(u)}>
                    <Ionicons name="create-outline" size={17} color={colors.primary} />
                    <Text style={styles.miniTxt}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.miniBtn}
                    disabled={u.id === authUser?.id}
                    onPress={() => setSuspendTarget(u)}
                  >
                    <Ionicons name="hand-left-outline" size={17} color={u.id === authUser?.id ? colors.textMuted : colors.danger} />
                    <Text
                      style={[
                        styles.miniTxtDanger,
                        u.id === authUser?.id && { color: colors.textMuted },
                      ]}
                    >
                      Suspend
                    </Text>
                  </Pressable>
                </View>
              </UserStripeCard>
            );
          }}
        />
      )}

      {edit ? (
        <UserEditModal
          userRow={edit}
          busy={saveBusy}
          onClose={() => editSet(null)}
          onSave={(patch) => void saveUserEdits(edit, patch)}
        />
      ) : null}

      <PlanShelfActionConfirmModal
        visible={suspendTarget != null}
        onClose={() => setSuspendTarget(null)}
        title="Suspend this account?"
        message="They will be marked suspended and should lose privileged flows. You can set them back to active from Edit. You cannot suspend your own account from here."
        cancelLabel="Cancel"
        confirmLabel="Suspend"
        confirmVariant="danger"
        onConfirm={async () => {
          if (!suspendTarget) return;
          if (suspendTarget.id === authUser?.id) return;
          await suspendUser(suspendTarget);
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

function EntypoTimeInline() {
  return <Ionicons name="time-outline" size={14} color={colors.textMuted} />;
}

type UserEditModalProps = {
  userRow: AdminUserListRow;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: {
    account_status: AccountStatus;
    verification_status: UserVerification;
    boost_credits: number;
    display_name: string;
    bio: string;
    verified_badge: boolean;
    is_profile_public: boolean;
  }) => void;
};

function UserEditModal({ userRow, busy, onClose, onSave }: UserEditModalProps) {
  const pr = oneProfile(userRow.profiles);
  const [account_status, setAccountStatus] = useState<AccountStatus>(userRow.account_status);
  const [verification_status, setVer] = useState<UserVerification>(userRow.verification_status);
  const [boost_credits, setBoost] = useState(String(userRow.boost_credits ?? 0));
  const [display_name, setName] = useState(pr?.display_name ?? '');
  const [bio, setBio] = useState(pr?.bio ?? '');
  const [verified_badge, setBadge] = useState(!!pr?.verified_badge);
  const [is_profile_public, setPublic] = useState(pr?.is_profile_public ?? true);

  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalAccent}
          />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Edit member</Text>
            <Text style={styles.monoSmall} selectable>
              {userRow.id}
            </Text>
            <Text style={styles.modalHint}>Email (read-only): {userRow.email ?? '—'}</Text>

            <Text style={styles.fieldLbl}>Display name</Text>
            <TextInput value={display_name} onChangeText={setName} style={styles.inp} placeholderTextColor={colors.textMuted} />

            <Text style={styles.fieldLbl}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              style={[styles.inp, { minHeight: 72 }]}
              multiline
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLbl}>Account status</Text>
            <View style={styles.choiceRow}>
              {ACCOUNTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setAccountStatus(s)}
                  style={[styles.choice, account_status === s && styles.choiceOn]}
                >
                  <Text style={[styles.choiceTxt, account_status === s && styles.choiceTxtOn]}>{s}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLbl}>Verification status</Text>
            <View style={styles.choiceRowWrap}>
              {VERIFS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setVer(s)}
                  style={[styles.choice, verification_status === s && styles.choiceOn]}
                >
                  <Text style={[styles.choiceTxt, verification_status === s && styles.choiceTxtOn]}>{s}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLbl}>Boost credits</Text>
            <TextInput
              value={boost_credits}
              onChangeText={setBoost}
              keyboardType="number-pad"
              style={styles.inp}
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLbl}>Verified host badge</Text>
              <Pressable
                onPress={() => setBadge(!verified_badge)}
                style={[styles.toggle, verified_badge && styles.toggleOn]}
              >
                <Text style={styles.toggleTxt}>{verified_badge ? 'On' : 'Off'}</Text>
              </Pressable>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLbl}>Profile public</Text>
              <Pressable
                onPress={() => setPublic(!is_profile_public)}
                style={[styles.toggle, is_profile_public && styles.toggleOn]}
              >
                <Text style={styles.toggleTxt}>{is_profile_public ? 'On' : 'Off'}</Text>
              </Pressable>
            </View>

            <AdminTrialPanel user={userRow} />
            <AdminGoodwillPanel userId={userRow.id} />

            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={styles.btnGhostFull} disabled={busy}>
                <Text style={styles.btnGhostTxt}>Close</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const n = Number.parseInt(boost_credits, 10);
                  onSave({
                    account_status,
                    verification_status,
                    boost_credits: Number.isFinite(n) ? Math.max(0, n) : 0,
                    display_name,
                    bio,
                    verified_badge,
                    is_profile_public,
                  });
                }}
                style={styles.btnPrimaryFull}
                disabled={busy}
              >
                <LinearGradient
                  colors={[colors.primary, '#8B7CFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.btnPrimaryTxt}>{busy ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInp: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 15 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  chips: { gap: 8, marginBottom: spacing.sm, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  chipOn: { backgroundColor: colors.primary },
  chipTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  chipTxtOn: { color: '#fff' },
  countHint: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  cardPress: { marginBottom: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 18,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#f1f5f9' },
  avatarPh: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadText: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  email: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  adminBadgeTxt: { fontSize: 10, fontWeight: '900', color: '#fff' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillTxt: { fontSize: 11, fontWeight: '800' },
  pillHost: { backgroundColor: 'rgba(108,99,255,0.12)', borderColor: 'rgba(108,99,255,0.25)' },
  pillHostTxt: { fontSize: 11, fontWeight: '800', color: colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meta: { fontSize: 12, fontWeight: '600', color: colors.textMuted, flex: 1 },
  rowActions: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  miniBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  miniTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
  miniTxtDanger: { fontSize: 13, fontWeight: '800', color: colors.danger },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginTop: spacing.sm },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,29,38,0.5)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  modalAccent: { height: 4, borderRadius: 2, marginBottom: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  monoSmall: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace', marginTop: 4 },
  modalHint: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.md },
  fieldLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  inp: {
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 6,
    color: colors.text,
    backgroundColor: colors.background,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  choiceRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  choice: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceTxt: { fontSize: 12, fontWeight: '800', color: colors.primary },
  choiceTxtOn: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(107,114,128,0.15)',
  },
  toggleOn: { backgroundColor: 'rgba(16,185,129,0.2)' },
  toggleTxt: { fontWeight: '800', color: colors.text },
  modalActions: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md },
  btnGhostFull: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostTxt: { fontWeight: '800', color: colors.text },
  btnPrimaryFull: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.button,
    overflow: 'hidden',
    position: 'relative',
  },
  btnPrimaryTxt: { fontWeight: '900', color: '#fff', zIndex: 1 },
});
