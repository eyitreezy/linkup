import { Button } from '@/components/Button';
import { KycLeadBlock } from '@/components/kyc/KycLeadBlock';
import { KycSectionHead } from '@/components/kyc/KycSectionHead';
import { KycStepFooter } from '@/components/kyc/KycStepFooter';
import { kycColors, kycInboxStyles, kycStyles } from '@/components/kyc/kycTheme';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const MAX_DURATION_SEC = 5;

type Props = {
  videoUri: string | null;
  onVideoChange: (uri: string | null) => void;
  onBack: () => void;
  onNext: () => void;
};

export function K3Liveness({ videoUri, onVideoChange, onBack, onNext }: Props) {
  const camRef = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [prompt, setPrompt] = useState<'blink' | 'turn'>('blink');

  async function ensurePerms(): Promise<boolean> {
    if (!camPerm?.granted) {
      const c = await requestCam();
      if (!c.granted) return false;
    }
    if (!micPerm?.granted) {
      const m = await requestMic();
      if (!m.granted) return false;
    }
    return true;
  }

  async function startRecording() {
    const ok = await ensurePerms();
    if (!ok || !camRef.current || !ready) return;
    setPrompt('blink');
    setRecording(true);
    try {
      const vid = await camRef.current.recordAsync({ maxDuration: MAX_DURATION_SEC });
      if (vid?.uri) onVideoChange(vid.uri);
    } catch {
      // fallback handled by UI
    } finally {
      setRecording(false);
    }
  }

  function stopEarly() {
    camRef.current?.stopRecording();
  }

  const canNext = !!videoUri;

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
          title="Quick video"
          subtitle={`Record a short clip (under ${MAX_DURATION_SEC} seconds) so we know you're really you. We keep the file small to save data.`}
        />

        <KycSectionHead title="On-screen prompts" />
        <View style={kycInboxStyles.frostedCard}>
          <LinearGradient
            colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promptInner}
          >
            <Ionicons
              name={prompt === 'blink' ? 'eye-outline' : 'swap-horizontal-outline'}
              size={28}
              color={colors.primary}
            />
            <View style={styles.promptTextCol}>
              <Text style={styles.promptTitle}>{prompt === 'blink' ? 'Blink slowly' : 'Turn your head slightly'}</Text>
              <Text style={styles.promptHint}>Then stay still — recording stops automatically.</Text>
            </View>
          </LinearGradient>
        </View>

        <KycSectionHead title="Selfie clip" />
        <View style={[kycInboxStyles.frostedCard, styles.videoCard]}>
          <View style={styles.videoBox}>
            {videoUri ? (
              <View style={styles.doneWrap}>
                <LinearGradient colors={[colors.primary, '#8B7CE8']} style={styles.doneIcon}>
                  <Ionicons name="checkmark-circle" size={36} color="#fff" />
                </LinearGradient>
                <Text style={styles.doneTitle}>Video captured</Text>
                <Text style={styles.doneHint}>You can re-record if needed.</Text>
              </View>
            ) : camPerm?.granted && micPerm?.granted ? (
              <CameraView
                ref={camRef}
                style={StyleSheet.absoluteFill}
                facing="front"
                mode="video"
                videoQuality="480p"
                mirror
                onCameraReady={() => setReady(true)}
              />
            ) : (
              <View style={styles.perm}>
                <LinearGradient
                  colors={['rgba(108,99,255,0.2)', 'rgba(255,101,132,0.1)']}
                  style={styles.permIcon}
                >
                  <Ionicons name="videocam-outline" size={32} color={colors.primary} />
                </LinearGradient>
                <Text style={styles.permT}>Camera + microphone for a quick selfie clip.</Text>
                <Button title="Allow access" onPress={() => void ensurePerms()} />
              </View>
            )}
          </View>
        </View>

        {recording ? (
          <View style={styles.recRow}>
            <ActivityIndicator color={kycColors.secondary} />
            <Text style={styles.recTxt}>Recording… blink, then turn your head</Text>
            <Button title="Stop" variant="secondary" onPress={stopEarly} />
          </View>
        ) : (
          <View style={styles.actions}>
            {!videoUri ? (
              <Button title="Start recording" onPress={() => void startRecording()} disabled={recording} />
            ) : (
              <Button title="Re-record" variant="secondary" onPress={() => onVideoChange(null)} />
            )}
          </View>
        )}

        <View style={styles.togglePrompt}>
          <Button title="Practice prompt: turn head" variant="ghost" onPress={() => setPrompt('turn')} />
        </View>
      </ScrollView>

      <KycStepFooter onBack={onBack} onContinue={onNext} continueDisabled={!canNext} />
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
  promptTextCol: { flex: 1 },
  promptTitle: { fontSize: 18, fontWeight: '900', color: kycColors.text },
  promptHint: { fontSize: 14, color: kycColors.muted, marginTop: 4, fontWeight: '600', lineHeight: 20 },
  videoCard: { padding: spacing.sm },
  videoBox: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1A1D26',
    margin: -spacing.xs,
  },
  perm: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  permIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permT: { color: '#fff', textAlign: 'center', marginBottom: spacing.md, fontWeight: '600', lineHeight: 22 },
  doneWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#1A1D26',
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  doneHint: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginTop: 6, fontWeight: '600' },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
  },
  recTxt: { flex: 1, color: kycColors.text, fontSize: 14, fontWeight: '600' },
  actions: { marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  togglePrompt: { marginBottom: spacing.sm, paddingHorizontal: spacing.md },
});
