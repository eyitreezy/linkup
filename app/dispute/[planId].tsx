/**
 * Plan dispute flow D1–D6 — structured steps, trust copy, video evidence (Expo Camera).
 */
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { submitPlanDisputeWithEvidence } from '@/lib/trust/submitPlanDispute';
import type { DbPlan, PlanDisputeCategory } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useEventListener } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const CATEGORIES: { id: PlanDisputeCategory; label: string; hint: string }[] = [
  { id: 'payment_issue', label: 'Payment issue', hint: 'Escrow, pricing, or checkout problems.' },
  { id: 'no_show', label: 'No-show', hint: 'Someone didn’t arrive as agreed.' },
  { id: 'misconduct', label: 'Misconduct', hint: 'Uncomfortable or unsafe behavior.' },
  { id: 'scam', label: 'Scam', hint: 'Deceptive or fraudulent behavior.' },
  { id: 'other', label: 'Other', hint: 'We’ll still review carefully.' },
];

const VIDEO_MIN_S = 5;
const VIDEO_MAX_S = 15;

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type ExtraImg = { localUri: string; mime: string; ext: string };

function DisputeVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') {
      Alert.alert('Preview', 'Could not load this clip. Try recording again.');
    }
  });
  return (
    <VideoView
      player={player}
      style={styles.previewVideo}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

export default function PlanDisputeScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [bidderId, setBidderId] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [category, setCategory] = useState<PlanDisputeCategory | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const recStarted = useRef(0);
  const camRef = useRef<CameraView>(null);
  const [permCam, reqCam] = useCameraPermissions();
  const [permMic, reqMic] = useMicrophonePermissions();
  const [extras, setExtras] = useState<ExtraImg[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpsMeta, setGpsMeta] = useState<{ latitude: number; longitude: number } | null>(null);

  const reportedUserId = useMemo(() => {
    if (!user?.id || !plan || !bidderId) return null;
    return plan.creator_id === user.id ? bidderId : plan.creator_id;
  }, [user?.id, plan, bidderId]);

  useEffect(() => {
    if (!planId || !isSupabaseConfigured) {
      setLoadingPlan(false);
      return;
    }
    let cancel = false;
    (async () => {
      const { data: p } = await supabase.from('plans').select('*').eq('id', planId).maybeSingle();
      if (cancel) return;
      if (p) {
        const row = p as DbPlan;
        setPlan(row);
        if (row.accepted_offer_id) {
          const { data: o } = await supabase
            .from('plan_offers')
            .select('bidder_id')
            .eq('id', row.accepted_offer_id)
            .maybeSingle();
          if (!cancel && o?.bidder_id) setBidderId(o.bidder_id as string);
        }
      }
      if (!cancel) setLoadingPlan(false);
    })();
    return () => {
      cancel = true;
    };
  }, [planId]);

  const openPickerExtras = useCallback(async () => {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6,
    });
    if (res.canceled || !res.assets?.length) return;
    const next: ExtraImg[] = [];
    for (const a of res.assets) {
      const mime = a.mimeType ?? 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : 'jpg';
      next.push({ localUri: a.uri, mime, ext });
    }
    setExtras((prev) => [...prev, ...next].slice(0, 8));
  }, []);

  const attachGps = useCallback(async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      Alert.alert('Location', 'Allow location to attach coordinates to your evidence (optional).');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setGpsMeta({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    Alert.alert('Attached', 'Approximate location will be included with your video evidence.');
  }, []);

  const startRecording = useCallback(async () => {
    const cam = camRef.current;
    if (!cam || !cameraReady || recording) return;
    if (!permCam?.granted) {
      await reqCam();
      return;
    }
    if (!permMic?.granted) {
      await reqMic();
      return;
    }
    setRecording(true);
    recStarted.current = Date.now();
    try {
      const result = await cam.recordAsync({ maxDuration: VIDEO_MAX_S });
      if (result?.uri) {
        const elapsed = (Date.now() - recStarted.current) / 1000;
        setVideoDuration(elapsed);
        setVideoUri(result.uri);
        if (elapsed + 0.25 < VIDEO_MIN_S) {
          Alert.alert(
            'A bit longer',
            `Please record at least ${VIDEO_MIN_S} seconds so we can understand what happened.`
          );
          setVideoUri(null);
          setVideoDuration(null);
        }
      }
    } catch (e) {
      Alert.alert('Recording', e instanceof Error ? e.message : 'Could not record');
    } finally {
      setRecording(false);
    }
  }, [cameraReady, permCam?.granted, permMic?.granted, recording, reqCam, reqMic]);

  const stopRecording = useCallback(() => {
    camRef.current?.stopRecording();
  }, []);

  const onSubmit = useCallback(async () => {
    if (!user?.id || !planId || !category || !reportedUserId || !videoUri) return;
    setBusy(true);
    const meta = {
      uploaded_at_client: new Date().toISOString(),
      duration_seconds: videoDuration ?? undefined,
      ...(gpsMeta ? { latitude: gpsMeta.latitude, longitude: gpsMeta.longitude } : {}),
    };
    const { error } = await submitPlanDisputeWithEvidence(supabase, {
      planId,
      reporterId: user.id,
      reportedUserId,
      category,
      reporterNote: note.trim() || null,
      video: { localUri: videoUri, mime: 'video/mp4', ext: 'mp4', meta },
      optionalImages: extras,
      textEvidence: null,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not submit', error);
      return;
    }
    setStep(6);
  }, [user?.id, planId, category, reportedUserId, videoUri, videoDuration, gpsMeta, note, extras]);

  if (!planId) {
    return null;
  }

  if (!user?.id) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <Text style={styles.muted}>Sign in to file a plan issue.</Text>
      </Screen>
    );
  }

  if (loadingPlan) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (!plan || !reportedUserId) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <Text style={styles.title}>Plan unavailable</Text>
        <Text style={styles.muted}>We couldn’t match you to this plan with an accepted offer.</Text>
        <Button title="Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} scroll={step !== 3}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.stepPill} numberOfLines={2}>
          Step {step} of 6 · {plan.title}
        </Text>
      </View>

      {step === 1 ? (
        <View style={styles.pad}>
          <Text style={styles.title}>Report an issue</Text>
          <Text style={styles.lead}>
            Tell us what went wrong with this plan. You’ll record a short video next — it helps us review fairly and
            quickly.
          </Text>
          <Text style={styles.trust}>
            Your report is confidential. Only you, the other participant, and safety staff can access dispute details.
          </Text>
          <Button title="Continue" onPress={() => setStep(2)} pill style={styles.cta} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.pad}>
          <Text style={styles.title}>What category fits best?</Text>
          <Text style={styles.sub}>Pick one — you can add notes and photos later.</Text>
          <ScrollView style={styles.catScroll} showsVerticalScrollIndicator={false}>
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[styles.catCard, on && styles.catCardOn]}
                >
                  <Text style={styles.catTitle}>{c.label}</Text>
                  <Text style={styles.catHint}>{c.hint}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button title="Continue" onPress={() => category && setStep(3)} disabled={!category} pill style={styles.cta} />
          <Button title="Back" variant="ghost" onPress={() => setStep(1)} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.cameraShell}>
          <Text style={styles.overlayHint}>
            Briefly explain what happened — {VIDEO_MIN_S} to {VIDEO_MAX_S} seconds.
          </Text>
          {!videoUri ? (
            <>
              <CameraView
                ref={camRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                mode="video"
                onCameraReady={() => setCameraReady(true)}
              />
              <View style={styles.camBar}>
                {!recording ? (
                  <Button title="Start recording" onPress={() => void startRecording()} disabled={!cameraReady} />
                ) : (
                  <Button title="Stop" variant="secondary" onPress={stopRecording} />
                )}
                <Button title="Optional: attach GPS" variant="ghost" onPress={() => void attachGps()} />
              </View>
            </>
          ) : (
            <View style={styles.previewWrap}>
              <DisputeVideoPreview uri={videoUri} />
              <View style={styles.rowBtns}>
                <Button
                  title="Retake"
                  variant="secondary"
                  onPress={() => {
                    setVideoUri(null);
                    setVideoDuration(null);
                  }}
                />
                <Button title="Use clip" onPress={() => setStep(4)} />
              </View>
            </View>
          )}
          <Pressable style={styles.camClose} onPress={() => setStep(2)}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
            <Text style={styles.camCloseTxt}>Back</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.pad}>
          <Text style={styles.title}>Additional evidence</Text>
          <Text style={styles.sub}>Optional screenshots. Add a short note for our reviewers.</Text>
          <Input
            variant="onboardingFlat"
            multiline
            numberOfLines={4}
            placeholder="Short note (optional)"
            value={note}
            onChangeText={setNote}
          />
          <Button title="Add images" variant="secondary" onPress={() => void openPickerExtras()} />
          {extras.length ? <Text style={styles.meta}>{extras.length} file(s) attached</Text> : null}
          <Button title="Continue" onPress={() => setStep(5)} pill style={styles.cta} />
          <Button title="Back" variant="ghost" onPress={() => setStep(3)} />
        </View>
      ) : null}

      {step === 5 ? (
        <View style={styles.pad}>
          <Text style={styles.title}>Review & submit</Text>
          <Text style={styles.sub}>Category: {CATEGORIES.find((c) => c.id === category)?.label}</Text>
          <Text style={styles.sub}>Video: attached</Text>
          {note.trim() ? <Text style={styles.sub}>Note: {note.trim()}</Text> : null}
          <Button title="Submit dispute" loading={busy} onPress={() => void onSubmit()} pill style={styles.cta} />
          <Button title="Back" variant="ghost" onPress={() => setStep(4)} disabled={busy} />
        </View>
      ) : null}

      {step === 6 ? (
        <View style={styles.pad}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Under review</Text>
          <Text style={styles.lead}>
            Thanks for taking the time. Our team usually responds within a few business days. We’ll notify you in-app
            — we never put sensitive details in push notifications.
          </Text>
          <Button title="Done" onPress={() => router.back()} pill style={styles.cta} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  back: { padding: spacing.xs },
  stepPill: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textMuted },
  pad: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  lead: { marginTop: spacing.sm, fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  trust: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  sub: { marginTop: spacing.sm, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  muted: { color: colors.textMuted, padding: spacing.md },
  cta: { marginTop: spacing.lg },
  catScroll: { maxHeight: 360, marginTop: spacing.md },
  catCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  catCardOn: { borderColor: colors.primary, backgroundColor: 'rgba(108, 99, 255, 0.06)' },
  catTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  catHint: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  cameraShell: {
    flex: 1,
    minHeight: 420,
    backgroundColor: '#000',
    borderRadius: radius.xl,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  overlayHint: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 2,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  camBar: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    zIndex: 2,
    gap: spacing.sm,
  },
  camClose: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.sm,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  camCloseTxt: { color: '#fff', fontWeight: '600' },
  previewWrap: { flex: 1, paddingTop: 48 },
  previewVideo: { flex: 1, backgroundColor: '#111' },
  rowBtns: { padding: spacing.md, gap: spacing.sm },
  meta: { marginTop: spacing.sm, color: colors.textMuted, fontSize: 13 },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
