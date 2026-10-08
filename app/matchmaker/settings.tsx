import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  deleteMatchMakerProfile,
  fetchMatchMakerSettingsSummary,
  formatCommunicationStyle,
  formatFamilyGoals,
  formatPace,
  setPoolVisibility,
  type MatchMakerSettingsSummary,
} from '@/lib/matchmaker/settingsApi';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [summary, setSummary] = useState<MatchMakerSettingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [poolBusy, setPoolBusy] = useState(false);
  const [deleteArm, setDeleteArm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      setSummary(await fetchMatchMakerSettingsSummary(user.id));
    } catch (e) {
      Alert.alert('MatchMaker Settings', e instanceof Error ? e.message : 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      setDeleteArm(false);
    }, [load])
  );

  async function onPoolToggle(next: boolean) {
    if (!summary || poolBusy) return;
    const prev = summary.poolVisible;
    setSummary({ ...summary, poolVisible: next });
    setPoolBusy(true);
    try {
      await setPoolVisibility(next);
    } catch (e) {
      setSummary({ ...summary, poolVisible: prev });
      Alert.alert('MatchMaker Settings', e instanceof Error ? e.message : 'Could not update visibility');
    } finally {
      setPoolBusy(false);
    }
  }

  function onDeletePress() {
    if (!deleteArm) {
      setDeleteArm(true);
      return;
    }
    Alert.alert(
      'Delete MatchMaker profile',
      'This hides you from MatchMaker and deactivates your intent. Your LinkUp account, values, and connection history are kept.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setDeleteArm(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void confirmDelete(),
        },
      ]
    );
  }

  async function confirmDelete() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteMatchMakerProfile();
      setDeleteArm(false);
      router.replace('/matchmaker' as Href);
    } catch (e) {
      Alert.alert('MatchMaker Settings', e instanceof Error ? e.message : 'Could not delete profile');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: MM.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
      }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={MM.text} />
        </Pressable>
        <Text style={styles.title}>MatchMaker Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.subtitle}>Private preferences for your MatchMaker experience.</Text>

      {loading || !summary ? (
        <ActivityIndicator color={MM.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <Text style={styles.section}>My Values</Text>
          <View style={styles.card}>
            <ValueRow
              label="Communication style"
              value={formatCommunicationStyle(summary.communicationStyle)}
              editLabel="Edit communication style"
              onEdit={() =>
                router.push({
                  pathname: '/matchmaker/values',
                  params: { from: 'settings', focus: 'communication' },
                } as Href)
              }
            />
            <ValueRow
              label="Faith preference"
              value={summary.faithSet ? 'Set (private)' : 'Not set'}
              editLabel="Edit faith preference"
              onEdit={() =>
                router.push({
                  pathname: '/matchmaker/values',
                  params: { from: 'settings', focus: 'faith' },
                } as Href)
              }
            />
            <ValueRow
              label="Family goals"
              value={formatFamilyGoals(summary.familyGoals)}
              editLabel="Edit family goals"
              onEdit={() =>
                router.push({
                  pathname: '/matchmaker/values',
                  params: { from: 'settings', focus: 'family' },
                } as Href)
              }
            />
            <ValueRow
              label="Pace preference"
              value={formatPace(summary.pacePreference)}
              editLabel="Edit pace preference"
              onEdit={() =>
                router.push({
                  pathname: '/matchmaker/values',
                  params: { from: 'settings', focus: 'pace' },
                } as Href)
              }
              last
            />
          </View>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>Dealbreakers</Text>
          <View style={styles.card}>
            <ValueRow
              label={summary.dealbreakersSummary}
              value=""
              editLabel="Edit dealbreakers"
              onEdit={() =>
                router.push({
                  pathname: '/matchmaker/values',
                  params: { from: 'settings', focus: 'dealbreakers' },
                } as Href)
              }
              last
              hideValue
            />
          </View>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>Pool visibility</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.rowLabel}>Show me in MatchMaker pool</Text>
              <Switch
                value={summary.poolVisible}
                onValueChange={(v) => void onPoolToggle(v)}
                disabled={poolBusy}
                trackColor={{ false: MM.border, true: MM.accent }}
              />
            </View>
          </View>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>Account</Text>
          <Pressable
            onPress={() => router.push('/matchmaker/history' as Href)}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>Connection history</Text>
          </Pressable>

          <Pressable
            onPress={onDeletePress}
            disabled={deleteBusy}
            style={styles.deleteBtn}
            accessibilityHint={deleteArm ? 'Tap again to confirm deletion' : 'Tap twice to confirm deletion'}
          >
            <Text style={styles.deleteText}>
              {deleteArm ? 'Tap again to confirm deletion' : 'Delete my MatchMaker profile'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function ValueRow({
  label,
  value,
  editLabel,
  onEdit,
  last,
  hideValue,
}: {
  label: string;
  value: string;
  editLabel: string;
  onEdit: () => void;
  last?: boolean;
  hideValue?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        {!hideValue ? <Text style={styles.rowLabel}>{label}</Text> : null}
        {!hideValue && value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {hideValue ? <Text style={styles.rowLabel}>{label}</Text> : null}
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={12}
        style={styles.editIconBtn}
        accessibilityRole="button"
        accessibilityLabel={editLabel}
      >
        <Ionicons name="create-outline" size={20} color={MM.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  subtitle: { fontFamily: fonts.regular, color: MM.muted, marginBottom: spacing.lg, lineHeight: 20 },
  section: { fontSize: 13, fontFamily: fonts.bold, color: MM.muted, marginBottom: spacing.sm },
  card: {
    backgroundColor: MM.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MM.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.medium, color: MM.text },
  rowValue: { marginTop: 2, fontFamily: fonts.regular, color: MM.muted, fontSize: 13 },
  editIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  outlineBtnText: { fontFamily: fonts.bold, color: MM.text },
  deleteBtn: { marginTop: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  deleteText: { fontFamily: fonts.medium, color: '#DC2626', textAlign: 'center' },
});
