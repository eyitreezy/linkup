import { Button } from '@/components/Button';
import { KycLeadBlock } from '@/components/kyc/KycLeadBlock';
import { KycLivenessVideoPreview } from '@/components/kyc/KycLivenessVideoPreview';
import { KycSectionHead } from '@/components/kyc/KycSectionHead';
import { KycStepFooter } from '@/components/kyc/KycStepFooter';
import { kycColors, kycInboxStyles, kycStyles } from '@/components/kyc/kycTheme';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const MAX_DURATION_SEC = 8;
const MIN_DURATION_SEC = 3;
const COUNTDOWN_START = 3;
const MAX_BYTES = 6 * 1024 * 1024;

type Phase = 'camera' | 'countdown' | 'recording' | 'review';
type Prompt = 'blink' | 'turn';

type Props = {
  videoUri: string | null;
  onVideoChange: (uri: string | null) => void;
  onBack: () => void;
  onNext: () => void;
};

export function K3Liveness({ videoUri, onVideoChange, onBack, onNext }: Props) {
  const camRef = useRef<CameraView>(null);
  const recStartedAt = useRef(0);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>(videoUri ? 'review' : 'camera');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<Prompt>('blink');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (videoUri) setPhase('review');
  }, [videoUri]);

  const ensurePerms = useCallback(async (): Promise<boolean> => {
    if (!camPerm?.granted) {
      const c = await requestCam();
      if (!c.granted) {
        Alert.alert('Camera needed', 'Allow camera access to record your verification clip.');
        return false;
      }
    }
    if (!micPerm?.granted) {
      const m = await requestMic();
      if (!m.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access for a short verification video.');
        return false;
      }
    }
    return true;
  }, [camPerm?.granted, micPerm?.granted, requestCam, requestMic]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const t = setInterval(() => {
      const sec = (Date.now() - recStartedAt.current) / 1000;
      setElapsedSec(sec);
      setPrompt(sec >= 2.5 ? 'turn' : 'blink');
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  const beginRecording = useCallback(async () => {
    if (!camRef.current || !ready) return;
    setPhase('recording');
    setPrompt('blink');
    setElapsedSec(0);
    recStartedAt.current = Date.now();
    setBusy(true);
    try {
      const vid = await camRef.current.recordAsync({
        maxDuration: MAX_DURATION_SEC,
        maxFileSize: MAX_BYTES,
      });
      const elapsed = (Date.now() - recStartedAt.current) / 1000;
      if (!vid?.uri) {
        Alert.alert('Recording failed', 'No video was saved. Try again in good lighting, face centered in the frame.');
        setPhase('camera');
        return;
      }
      if (elapsed < MIN_DURATION_SEC) {
        Alert.alert(
          'A little longer',
          `Record at least ${MIN_DURATION_SEC} seconds so we can verify liveness.`
        );
        setPhase('camera');
        return;
      }
      onVideoChange(vid.uri);
      setPhase('review');
    } catch (e) {
      Alert.alert(
        'Recording failed',
        e instanceof Error ? e.message : 'Could not complete recording. Check permissions and try again.'
      );
      setPhase('camera');
    } finally {
      setBusy(false);
      setCountdown(null);
    }
  }, [onVideoChange, ready]);

  useEffect(() => {
    if (phase !== 'countdown' || countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void beginRecording();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c != null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, beginRecording]);

  async function startCountdown() {
    const ok = await ensurePerms();
    if (!ok || !ready) return;
    setPhase('countdown');
    setCountdown(COUNTDOWN_START);
  }

  function stopEarly() {
    camRef.current?.stopRecording();
  }

  function retake() {
    onVideoChange(null);
    setPhase('camera');
    setElapsedSec(0);
    setPrompt('blink');
  }

  const hasPerms = !!(camPerm?.granted && micPerm?.granted);
  const showCamera = phase === 'camera' || phase === 'countdown' || phase === 'recording';
  const recording = phase === 'recording';
  const progress = Math.min(1, elapsedSec / MAX_DURATION_SEC);

  return (
    <View style={kycStyles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={kycInboxStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <KycLeadBlock
          kicker="Liveness"
          title="Selfie video"
          subtitle={`A ${MIN_DURATION_SEC}–${MAX_DURATION_SEC} second clip in good light. You'll preview it before continuing.`}
        />

        <KycSectionHead title="Live prompts" />
        <View style={kycInboxStyles.frostedCard}>
          <LinearGradient
            colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promptInner}
          >
            <View style={[styles.promptIcon, recording && styles.promptIconRec]}>
              <Ionicons
                name={prompt === 'blink' ? 'eye-outline' : 'swap-horizontal-outline'}
                size={26}
                color={recording ? '#fff' : colors.primary}
              />
            </View>
            <View style={styles.promptTextCol}>
              <Text style={styles.promptTitle}>
                {phase === 'review'
                  ? 'Review your clip'
                  : prompt === 'blink'
                    ? 'Blink slowly'
                    : 'Turn your head slightly'}
              </Text>
              <Text style={styles.promptHint}>
                {phase === 'review'
                  ? 'Use native controls to play. Re-record if your face was blurry or off-center.'
                  : recording
                    ? 'Follow the prompt, then hold still until recording ends.'
                    : 'Recording starts after a short countdown.'}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <KycSectionHead title={phase === 'review' ? 'Preview' : 'Camera'} />
        <View style={[kycInboxStyles.frostedCard, styles.videoCard]}>
          <View style={styles.videoBox}>
            {phase === 'review' && videoUri ? (
              <KycLivenessVideoPreview uri={videoUri} style={StyleSheet.absoluteFill} />
            ) : hasPerms ? (
              <>
                <CameraView
                  ref={camRef}
                  style={StyleSheet.absoluteFill}
                  facing="front"
                  mode="video"
                  videoQuality="720p"
                  mirror
                  onCameraReady={() => setReady(true)}
                />
                <FaceGuide />
                {phase === 'countdown' && countdown != null ? (
                  <View style={styles.countdownOverlay}>
                    <Text style={styles.countdownNum}>{countdown}</Text>
                    <Text style={styles.countdownLbl}>Get ready</Text>
                  </View>
                ) : null}
                {recording ? (
                  <View style={styles.recordingOverlay}>
                    <View style={styles.recPill}>
                      <View style={styles.recDot} />
                      <Text style={styles.recPillTxt}>REC {elapsedSec.toFixed(0)}s</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                  </View>
                ) : null}
                {!ready ? (
                  <View style={styles.camLoading}>
                    <ActivityIndicator color="#fff" size="large" />
                    <Text style={styles.camLoadingTxt}>Starting camera…</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.perm}>
                <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.permIcon}>
                  <Ionicons name="videocam" size={32} color="#fff" />
                </LinearGradient>
                <Text style={styles.permT}>Camera and microphone are required for a short selfie clip.</Text>
                <Button title="Allow access" onPress={() => void ensurePerms()} />
              </View>
            )}
          </View>
        </View>

        <View style={styles.tipsCard}>
          <Ionicons name="sunny-outline" size={18} color={colors.primary} />
          <Text style={styles.tipsTxt}>
            Face the light, remove sunglasses, and keep your full face inside the oval for a clear recording.
          </Text>
        </View>

        <View style={styles.actions}>
          {phase === 'review' ? (
            <Button title="Re-record video" variant="secondary" onPress={retake} disabled={busy} />
          ) : recording ? (
            <Button title="Stop recording" variant="secondary" onPress={stopEarly} disabled={busy} />
          ) : (
            <Button
              title={busy ? 'Please wait…' : showCamera && ready ? 'Start recording' : 'Preparing camera…'}
              onPress={() => void startCountdown()}
              disabled={!showCamera || !ready || busy || phase === 'countdown'}
              gradient
              pill
            />
          )}
        </View>
      </ScrollView>

      <KycStepFooter onBack={onBack} onContinue={onNext} continueDisabled={!videoUri} />
    </View>
  );
}

function FaceGuide() {
  return (
    <View style={styles.guideWrap} pointerEvents="none">
      <View style={styles.oval} />
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
      <Text style={styles.guideHint}>Center your face in the oval</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  promptInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    margin: -spacing.xs,
  },
  promptIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(108,99,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptIconRec: {
    backgroundColor: colors.secondary,
  },
  promptTextCol: { flex: 1 },
  promptTitle: { fontSize: 17, fontWeight: '900', color: kycColors.text },
  promptHint: { fontSize: 14, color: kycColors.muted, marginTop: 4, fontWeight: '600', lineHeight: 20 },
  videoCard: { padding: spacing.sm },
  videoBox: {
    height: 340,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0f1118',
    margin: -spacing.xs,
  },
  guideWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    width: '72%',
    aspectRatio: 3 / 4,
    maxHeight: '78%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(108,99,255,0.06)',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#fff',
  },
  cornerTL: { top: '14%', left: '10%', borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: '14%', right: '10%', borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: '18%', left: '10%', borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: '18%', right: '10%', borderBottomWidth: 3, borderRightWidth: 3 },
  guideHint: {
    position: 'absolute',
    bottom: spacing.md,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,17,24,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNum: {
    fontSize: 72,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 80,
  },
  countdownLbl: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: spacing.sm },
  recordingOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: 'rgba(239,68,68,0.92)',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  recPillTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  camLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  camLoadingTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  perm: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, minHeight: 280 },
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permT: {
    color: kycColors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '600',
    lineHeight: 22,
    fontSize: 15,
  },
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  tipsTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: kycColors.text, lineHeight: 19 },
  actions: { marginBottom: spacing.sm, paddingHorizontal: spacing.md },
});
