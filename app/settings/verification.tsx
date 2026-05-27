/**
 * Settings — verification status, explainer, and audit trail (matches create/plan-management polish).
 */
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchLatestVerificationRequest } from '@/lib/verification/submitVerification';
import { isUserVerified } from '@/lib/verification/access';
import type { DbVerificationEvent } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type VerificationUiStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

function friendlyStatus(v: string): { title: string; sub: string } {
  switch (v) {
    case 'unverified':
      return { title: 'Not verified yet', sub: 'Complete verification to unlock plans, offers, and escrow.' };
    case 'pending':
      return {
        title: 'Review in progress',
        sub: 'We’re checking your documents. You’ll get an in-app update—usually soon.',
      };
    case 'verified':
      return {
        title: 'Verified',
        sub: 'You’re cleared for trust-gated features across LinkUp.',
      };
    case 'rejected':
      return {
        title: 'Couldn’t verify this round',
        sub: 'Open verification again to submit clearer documents if you’d like to retry.',
      };
    default:
      return { title: v, sub: '' };
  }
}

function statusVisual(v: VerificationUiStatus): {
  pillBg: string;
  pillBorder: string;
  pillFg: string;
  ringColors: [string, string];
  heroIcon: keyof typeof Ionicons.glyphMap;
  trailAccent: string;
} {
  switch (v) {
    case 'verified':
      return {
        pillBg: 'rgba(16,185,129,0.14)',
        pillBorder: 'rgba(16,185,129,0.4)',
        pillFg: '#047857',
        ringColors: ['rgba(16,185,129,0.35)', 'rgba(108,99,255,0.28)'],
        heroIcon: 'shield-checkmark',
        trailAccent: colors.success,
      };
    case 'pending':
      return {
        pillBg: 'rgba(245,158,11,0.16)',
        pillBorder: 'rgba(245,158,11,0.4)',
        pillFg: '#B45309',
        ringColors: ['rgba(245,158,11,0.4)', 'rgba(255,101,132,0.22)'],
        heroIcon: 'time',
        trailAccent: colors.warning,
      };
    case 'rejected':
      return {
        pillBg: 'rgba(239,68,68,0.12)',
        pillBorder: 'rgba(239,68,68,0.35)',
        pillFg: colors.danger,
        ringColors: ['rgba(239,68,68,0.35)', 'rgba(245,158,11,0.2)'],
        heroIcon: 'alert-circle',
        trailAccent: colors.danger,
      };
    default:
      return {
        pillBg: 'rgba(108,99,255,0.12)',
        pillBorder: 'rgba(108,99,255,0.35)',
        pillFg: colors.primary,
        ringColors: ['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.22)'],
        heroIcon: 'finger-print-outline',
        trailAccent: colors.primary,
      };
  }
}

function eventIcon(eventType: string): keyof typeof Ionicons.glyphMap {
  const t = eventType.toLowerCase();
  if (t.includes('approv')) return 'checkmark-circle';
  if (t.includes('reject')) return 'close-circle';
  if (t.includes('submit')) return 'cloud-upload-outline';
  if (t.includes('vendor')) return 'business-outline';
  if (t.includes('admin')) return 'person-outline';
  if (t.includes('status')) return 'swap-horizontal';
  return 'ellipse';
}

function formatEventLabel(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VerificationStatusScreen() {
  const { dbUser } = useAuth();
  const v = (dbUser?.verification_status ?? 'unverified') as VerificationUiStatus;
  const ok = isUserVerified(v);
  const copy = friendlyStatus(v);
  const vis = useMemo(() => statusVisual(v), [v]);

  const [timeline, setTimeline] = useState<DbVerificationEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);

  const loadTimeline = useCallback(async () => {
    if (!isSupabaseConfigured || !dbUser?.id) return;
    setBusy(true);
    const req = await fetchLatestVerificationRequest(dbUser.id);
    if (!req) {
      setTimeline([]);
      setHasRequest(false);
      setBusy(false);
      return;
    }
    setHasRequest(true);
    const { data } = await supabase
      .from('verification_events')
      .select('*')
      .eq('verification_id', req.id)
      .order('created_at', { ascending: true });
    setTimeline((data ?? []) as DbVerificationEvent[]);
    setBusy(false);
  }, [dbUser?.id]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  return (
    <Screen scroll={false} safeAreaEdges={['left', 'right']} safeAreaStyle={styles.screenBg}>
      <View style={styles.root}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.background]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.leadRow}>
            <LinearGradient colors={vis.ringColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroRing}>
              <View style={styles.heroIconInner}>
                <Ionicons name={vis.heroIcon} size={32} color={colors.primary} />
              </View>
            </LinearGradient>
            <View style={styles.leadText}>
              <Text style={styles.kicker}>Trust & identity</Text>
              <Text style={styles.screenTitle}>Verification</Text>
              <Text style={styles.screenSub}>Your status, what it unlocks, and a transparent audit trail.</Text>
            </View>
          </View>

          <LinearGradient colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.1)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusCardOuter}>
            <View style={styles.statusCardInner}>
              <View style={styles.statusTop}>
                <View style={styles.statusTitleCol}>
                  <Text style={styles.cardEyebrow}>Current status</Text>
                  <Text style={styles.statusHeadline}>{copy.title}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: vis.pillBg, borderColor: vis.pillBorder }]}>
                  <View style={[styles.statusDot, { backgroundColor: vis.pillFg }]} />
                  <Text style={[styles.statusPillTxt, { color: vis.pillFg }]}>{copy.title}</Text>
                </View>
              </View>
              <Text style={styles.cardBody}>{copy.sub}</Text>
              <View style={styles.infoCallout}>
                <Ionicons name="information-circle" size={22} color={colors.primary} />
                <Text style={styles.infoCalloutTxt}>
                  Verification is required to create plans, negotiate offers, and use escrow. Premium does not replace
                  this step.
                </Text>
              </View>
              {!ok ? (
                <Button
                  title="Start or resume verification"
                  onPress={() => router.push('/kyc' as Href)}
                  style={styles.primaryBtn}
                />
              ) : (
                <View style={styles.verifiedBanner}>
                  <LinearGradient colors={['rgba(16,185,129,0.18)', 'rgba(52,211,153,0.12)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  <Ionicons name="checkmark-circle" size={24} color="#047857" style={styles.verifiedIcon} />
                  <View style={styles.verifiedTextCol}>
                    <Text style={styles.verifiedTitle}>You’re all set</Text>
                    <Text style={styles.verifiedSub}>Verified for trust-gated features across LinkUp.</Text>
                  </View>
                </View>
              )}
            </View>
          </LinearGradient>

          <View style={styles.trailSectionHead}>
            <Ionicons name="git-branch-outline" size={22} color={colors.primary} />
            <View style={styles.trailHeadText}>
              <Text style={styles.trailTitle}>Your verification trail</Text>
              <Text style={styles.trailSubtitle}>We log each step so the process stays transparent.</Text>
            </View>
          </View>

          <View style={styles.trailCard}>
            {busy ? (
              <ActivityIndicator color={colors.primary} style={styles.trailLoader} />
            ) : !hasRequest ? (
              <View style={styles.trailEmpty}>
                <View style={styles.trailEmptyIconWrap}>
                  <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
                </View>
                <Text style={styles.trailEmptyTitle}>No submission yet</Text>
                <Text style={styles.trailEmptySub}>
                  After you start verification, timestamps and milestones appear here as we process your request.
                </Text>
                {!ok ? (
                  <Button title="Begin verification" variant="secondary" onPress={() => router.push('/kyc' as Href)} style={styles.trailEmptyBtn} />
                ) : null}
              </View>
            ) : timeline.length === 0 ? (
              <View style={styles.trailEmpty}>
                <View style={styles.trailEmptyIconWrap}>
                  <Ionicons name="hourglass-outline" size={40} color={colors.warning} />
                </View>
                <Text style={styles.trailEmptyTitle}>No logged events yet</Text>
                <Text style={styles.trailEmptySub}>
                  Events from our verification partner and review steps will show up here soon.
                </Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {timeline.map((e, i) => {
                  const last = i === timeline.length - 1;
                  return (
                    <View key={e.id} style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <LinearGradient colors={[vis.trailAccent, colors.primary]} style={styles.timelineDot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Ionicons name={eventIcon(e.event_type)} size={14} color="#fff" />
                        </LinearGradient>
                        {!last ? <View style={styles.timelineLine} /> : null}
                      </View>
                      <View style={styles.timelineCard}>
                        <Text style={styles.timelineLabel}>{formatEventLabel(e.event_type)}</Text>
                        <Text style={styles.timelineTime}>{new Date(e.created_at).toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenBg: { backgroundColor: 'transparent', flex: 1 },
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
    paddingTop: spacing.sm,
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroRing: {
    width: 72,
    height: 72,
    borderRadius: 24,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconInner: {
    flex: 1,
    width: '100%',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  leadText: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  screenSub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 22,
  },
  statusCardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
  },
  statusCardInner: {
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: spacing.lg,
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusTitleCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  statusHeadline: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  cardBody: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 23,
    marginBottom: spacing.md,
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(108,99,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.15)',
    marginBottom: spacing.md,
  },
  infoCalloutTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 21,
  },
  primaryBtn: { marginTop: spacing.xs },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    marginTop: spacing.xs,
    position: 'relative',
  },
  verifiedIcon: { zIndex: 1 },
  verifiedTextCol: { flex: 1, zIndex: 1 },
  verifiedTitle: { fontSize: 16, fontWeight: '900', color: '#047857' },
  verifiedSub: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  trailSectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  trailHeadText: { flex: 1 },
  trailTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
  trailSubtitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  trailCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.14)',
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#1A1D26',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  trailLoader: { marginVertical: spacing.lg },
  trailEmpty: { alignItems: 'center', paddingVertical: spacing.md },
  trailEmptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(108,99,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.12)',
  },
  trailEmptyTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 6 },
  trailEmptySub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  trailEmptyBtn: { alignSelf: 'stretch', marginHorizontal: spacing.xl },
  timeline: { marginTop: spacing.xs },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineRail: { width: 36, alignItems: 'center' },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: 'rgba(108,99,255,0.2)',
    marginVertical: 4,
    borderRadius: 1,
  },
  timelineCard: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.lg,
    minWidth: 0,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'capitalize',
    letterSpacing: -0.1,
  },
  timelineTime: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
});
