import { Button } from '@/components/Button';
import { kycColors, kycStyles } from '@/components/kyc/kycTheme';
import { radius, spacing } from '@/constants/theme';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_DURATION_SEC = 5;

type Props = {
  videoUri: string | null;
  onVideoChange: (uri: string | null) => void;
  onBack: () => void;
  onNext: () => void;
};

export function K3Liveness({ videoUri, onVideoChange, onBack, onNext }: Props) {
  const insets = useSafeAreaInsets();
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[kycStyles.title, { marginTop: spacing.sm }]}>Quick video</Text>
        <Text style={kycStyles.subtitle}>
          Record a short clip (under {MAX_DURATION_SEC} seconds) so we know you&apos;re really you. Follow the on-screen
          prompts — we keep the file small to save data.
        </Text>

        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>{prompt === 'blink' ? 'Blink slowly' : 'Turn your head slightly'}</Text>
          <Text style={styles.promptHint}>Then stay still — recording stops automatically.</Text>
        </View>

        <View style={styles.videoBox}>
          {videoUri ? (
            <Text style={styles.done}>
              Video captured {'\u2713'}
              {'\n'}You can re-record if needed.
            </Text>
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
              <Text style={styles.permT}>Camera + microphone for a quick selfie clip.</Text>
              <Button title="Allow access" onPress={() => void ensurePerms()} />
            </View>
          )}
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

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            ...Platform.select({
              ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.08,
                shadowRadius: 16,
              },
              android: { elevation: 18 },
            }),
          },
        ]}
      >
        <View style={styles.footerRow}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.footerBtnGhost, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.footerBtnGhostText}>Back</Text>
          </Pressable>
          <Pressable
            onPress={onNext}
            disabled={!canNext}
            style={({ pressed }) => [
              styles.footerBtnPrimary,
              !canNext && styles.footerBtnPrimaryDisabled,
              pressed && canNext && { opacity: 0.92 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={[styles.footerBtnPrimaryText, !canNext && styles.footerBtnPrimaryTextDisabled]}>
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  promptCard: {
    backgroundColor: kycColors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  promptTitle: { fontSize: 18, fontWeight: '800', color: kycColors.text },
  promptHint: { fontSize: 14, color: kycColors.muted, marginTop: 4 },
  videoBox: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#222',
    marginBottom: spacing.md,
  },
  perm: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  permT: { color: '#fff', textAlign: 'center', marginBottom: spacing.md },
  done: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#fff',
    fontSize: 16,
    padding: spacing.lg,
    fontWeight: '600',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  recTxt: { flex: 1, color: kycColors.text, fontSize: 14 },
  actions: { marginBottom: spacing.sm },
  togglePrompt: { marginBottom: spacing.sm },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  footerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  footerBtnGhost: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: kycColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  footerBtnGhostText: { fontSize: 16, fontWeight: '700', color: kycColors.primary },
  footerBtnPrimary: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: kycColors.primary,
  },
  footerBtnPrimaryDisabled: { backgroundColor: '#E5E7EB' },
  footerBtnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  footerBtnPrimaryTextDisabled: { color: '#9CA3AF' },
});
