/**
 * Read-only plan dispute detail for filers after submission.
 */
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { DbDispute, DbDisputeEvidence, DbPlan, PlanDisputeResolution } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const CATEGORY_LABELS: Record<string, string> = {
  payment_issue: 'Payment issue',
  no_show: 'No-show',
  misconduct: 'Misconduct',
  scam: 'Scam',
  other: 'Other',
};

function statusPill(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case 'resolved':
      return { bg: 'rgba(52, 211, 153, 0.16)', fg: '#047857', label: 'Resolved' };
    case 'rejected':
      return { bg: 'rgba(239, 68, 68, 0.12)', fg: colors.danger, label: 'Rejected' };
    case 'reviewing':
      return { bg: 'rgba(108, 99, 255, 0.14)', fg: colors.primary, label: 'Reviewing' };
    default:
      return { bg: 'rgba(108, 99, 255, 0.14)', fg: colors.primary, label: 'Pending' };
  }
}

function resolutionCopy(resolution: PlanDisputeResolution | null, status: string): string {
  if (status === 'rejected') return 'This dispute was not upheld.';
  if (resolution === 'refund') return 'A full refund resolution was applied where applicable.';
  if (resolution === 'partial') return 'A partial resolution was applied.';
  if (resolution === 'none') return 'Closed with no payout action.';
  return 'Our team is reviewing your submission.';
}

function EvidenceVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') Alert.alert('Video', 'Could not load evidence clip.');
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

export default function PlanDisputeDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [dispute, setDispute] = useState<DbDispute | null>(null);
  const [evidence, setEvidence] = useState<DbDisputeEvidence[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId || !user || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: p } = await supabase.from('plans').select('id, title').eq('id', planId).maybeSingle();
    setPlan((p as DbPlan) ?? null);

    const { data: d } = await supabase
      .from('disputes')
      .select('*')
      .eq('plan_id', planId)
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const disp = (d as DbDispute) ?? null;
    setDispute(disp);

    if (disp) {
      const { data: ev } = await supabase
        .from('dispute_evidence')
        .select('*')
        .eq('dispute_id', disp.id)
        .order('created_at', { ascending: true });
      const rows = (ev as DbDisputeEvidence[]) ?? [];
      setEvidence(rows);
      const urls: Record<string, string> = {};
      for (const row of rows) {
        if (row.file_path) {
          const { data: signed } = await supabase.storage
            .from('private_disputes')
            .createSignedUrl(row.file_path, 3600);
          if (signed?.signedUrl) urls[row.id] = signed.signedUrl;
        }
      }
      setSignedUrls(urls);
    } else {
      setEvidence([]);
      setSignedUrls({});
    }
    setLoading(false);
  }, [planId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (!dispute) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <Text style={styles.title}>No dispute on file</Text>
        <Button title="File a dispute" onPress={() => router.push(`/dispute/${planId}` as Href)} />
      </Screen>
    );
  }

  const st = statusPill(dispute.status);
  const video = evidence.find((e) => e.type === 'video');
  const images = evidence.filter((e) => e.type === 'image');

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.heading}>Plan dispute</Text>
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Text style={[styles.pillTxt, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push(`/plan/${planId}` as Href)}>
          <Text style={styles.planLink}>{plan?.title ?? 'View plan'}</Text>
        </Pressable>
        <Text style={styles.meta}>
          Filed {new Date(dispute.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </Text>
        <Text style={styles.meta}>Category: {CATEGORY_LABELS[dispute.category] ?? dispute.category}</Text>

        <Text style={styles.sectionTitle}>Your submission</Text>
        {video && signedUrls[video.id] ? <EvidenceVideo uri={signedUrls[video.id]} /> : null}
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
            {images.map((img) =>
              signedUrls[img.id] ? (
                <Pressable key={img.id} onPress={() => void Linking.openURL(signedUrls[img.id])}>
                  <Image source={{ uri: signedUrls[img.id] }} style={styles.thumb} />
                </Pressable>
              ) : null
            )}
          </ScrollView>
        ) : null}
        {dispute.reporter_note ? <Text style={styles.note}>{dispute.reporter_note}</Text> : null}

        {(dispute.status === 'resolved' || dispute.status === 'rejected') && (
          <>
            <Text style={styles.sectionTitle}>Resolution</Text>
            <View style={styles.resolutionBox}>
              <Text style={styles.resolutionTxt}>
                {resolutionCopy(dispute.resolution, dispute.status)}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heading: { flex: 1, fontSize: 20, fontWeight: '900', color: colors.text },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.button },
  pillTxt: { fontSize: 12, fontWeight: '800' },
  planLink: { fontSize: 17, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  meta: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  video: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: '#000',
    marginBottom: spacing.sm,
  },
  imageRow: { marginBottom: spacing.sm },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.border,
  },
  note: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  resolutionBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  resolutionTxt: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 22 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, margin: spacing.md },
});
