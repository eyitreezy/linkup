/**
 * Admin — publish and view privacy policy versions.
 */
import { AdminListSkeleton } from '@/components/admin/AdminListSkeleton';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { DbPrivacyPolicyVersion } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function AdminPrivacyPolicyPanel({
  refreshing = false,
  registerReload,
}: {
  refreshing?: boolean;
  registerReload?: (reload: (() => Promise<void>) | null) => void;
} = {}) {
  const { user } = useAuth();
  const [currentVersion, setCurrentVersion] = useState<DbPrivacyPolicyVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [newVersion, setNewVersion] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [busy, setBusy] = useState(false);

  const refetchCurrentVersion = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    const { data, error } = await supabase
      .from('privacy_policy_versions')
      .select('*')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) Alert.alert('Privacy policy', error.message);
    else setCurrentVersion((data as DbPrivacyPolicyVersion | null) ?? null);
    if (!options?.silent) setLoading(false);
  }, []);

  useEffect(() => {
    registerReload?.(() => refetchCurrentVersion({ silent: true }));
    return () => registerReload?.(null);
  }, [refetchCurrentVersion, registerReload]);

  useEffect(() => {
    void refetchCurrentVersion();
  }, [refetchCurrentVersion]);

  async function handlePublish() {
    if (!newVersion.trim() || !newContent.trim()) {
      Alert.alert('Publish', 'Version label and policy content are required.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('privacy_policy_versions').insert({
      version: newVersion.trim(),
      content: newContent.trim(),
      summary_of_changes: newSummary.trim() || null,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Publish failed', error.message);
      return;
    }
    setNewVersion('');
    setNewContent('');
    setNewSummary('');
    void refetchCurrentVersion();
    Alert.alert('Published', 'New privacy policy version is live. Existing users will see the re-consent banner.');
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headRow}>
        <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        <Text style={styles.panelTitle}>Privacy Policy</Text>
      </View>

      {refreshing || loading ? (
        <AdminListSkeleton count={2} />
      ) : currentVersion ? (
        <View style={styles.currentVersionCard}>
          <Text style={styles.currentVersionLabel}>
            Current: v{currentVersion.version} · effective {formatDate(currentVersion.effective_date)}
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>No policy published yet. Publish the first version below.</Text>
      )}

      <View style={styles.publishForm}>
        <Text style={styles.fieldLbl}>Publish new version</Text>
        <TextInput
          style={styles.inp}
          placeholder="Version (e.g. 1.1)"
          placeholderTextColor={colors.textMuted}
          value={newVersion}
          onChangeText={setNewVersion}
        />
        <TextInput
          style={[styles.inp, styles.textArea]}
          placeholder="Full policy content (plain text; blank lines separate paragraphs)"
          placeholderTextColor={colors.textMuted}
          value={newContent}
          onChangeText={setNewContent}
          multiline
          textAlignVertical="top"
        />
        <TextInput
          style={styles.inp}
          placeholder="Summary of changes (optional, shown to existing users)"
          placeholderTextColor={colors.textMuted}
          value={newSummary}
          onChangeText={setNewSummary}
        />
        <Pressable
          disabled={busy}
          onPress={() => void handlePublish()}
          style={({ pressed }) => [styles.publishButton, pressed && !busy && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[colors.primary, '#8B7CE8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.publishButtonGrad}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.publishButtonLabel}>Publish new version</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  panelTitle: { fontSize: 16, fontWeight: '900', fontFamily: fonts.bold, color: colors.text },
  currentVersionCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.15)',
    marginBottom: spacing.sm,
  },
  currentVersionLabel: { fontSize: 13, fontWeight: '700', fontFamily: fonts.medium, color: colors.text },
  empty: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.md, fontFamily: fonts.medium },
  publishForm: { marginTop: spacing.sm, gap: spacing.xs },
  fieldLbl: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 4,
    fontFamily: fonts.bold,
  },
  inp: {
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.2)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textArea: { minHeight: 140 },
  publishButton: {
    marginTop: spacing.md,
    borderRadius: radius.button,
    overflow: 'hidden',
    minHeight: 48,
  },
  publishButtonGrad: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  publishButtonLabel: { fontSize: 15, fontWeight: '800', fontFamily: fonts.bold, color: '#fff' },
});
