import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  VIDEO_CAMERA_PRE_PERMISSION,
  VIDEO_NDPR_CONSENT,
} from '@/lib/plans/policySignOffContent';
import { supabase } from '@/lib/supabase';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  planId: string;
  reportedUserId: string;
  onVideoSubmitted: (disputeId: string) => void;
};

export function VideoEvidenceCapture({ planId, reportedUserId, onVideoSubmitted }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permCam, reqCam] = useCameraPermissions();
  const [permMic, reqMic] = useMicrophonePermissions();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  const hasPermission = permCam?.granted && permMic?.granted;
  const permissionPending = consentAccepted && (permCam == null || permMic == null);

  const ensurePermissions = async () => {
    if (!permCam?.granted) await reqCam();
    if (!permMic?.granted) await reqMic();
  };

  const startRecording = async () => {
    await ensurePermissions();
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    setError('');
    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });
      if (video?.uri) setRecordedUri(video.uri);
    } catch {
      setError('Recording failed. Please try again.');
    } finally {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  const handleSubmit = async () => {
    if (!recordedUri) return;
    setIsSubmitting(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let gpsLat: number | null = null;
      let gpsLng: number | null = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        gpsLat = loc.coords.latitude;
        gpsLng = loc.coords.longitude;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not signed in');

      const formData = new FormData();
      formData.append('video', {
        uri: recordedUri,
        type: 'video/mp4',
        name: 'dispute-evidence.mp4',
      } as unknown as Blob);
      formData.append('plan_id', planId);
      formData.append('reported_user_id', reportedUserId);
      if (gpsLat !== null) formData.append('gps_lat', gpsLat.toString());
      if (gpsLng !== null) formData.append('gps_lng', gpsLng.toString());

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-dispute-video`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );
      const data = (await res.json()) as { dispute_id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (!data.dispute_id) throw new Error('Upload failed');
      onVideoSubmitted(data.dispute_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Video submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!consentAccepted) {
    return (
      <View style={styles.container} collapsable={false}>
        <Text style={styles.bodyText}>
          Record a short video from the meetup location. Show the venue and state that your meetup
          partner has not arrived.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.captionText}>{VIDEO_CAMERA_PRE_PERMISSION}</Text>
        </View>
        <Pressable
          style={styles.primaryButtonOuter}
          onPress={() => {
            setConsentAccepted(true);
            void ensurePermissions();
          }}
        >
          <LinearGradient
            colors={[colors.primary, '#8B7CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonLabel}>Continue to camera</Text>
          </LinearGradient>
        </Pressable>
        <Text style={styles.captionText}>{VIDEO_NDPR_CONSENT}</Text>
      </View>
    );
  }

  if (permissionPending) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bodyText}>Requesting camera access...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Camera access is required to submit video evidence. Please enable it in your device
          Settings.
        </Text>
        <Pressable style={styles.primaryButtonOuter} onPress={() => void ensurePermissions()}>
          <LinearGradient
            colors={[colors.primary, '#8B7CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonLabel}>Grant camera access</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  if (recordedUri) {
    return (
      <View style={styles.container} collapsable={false}>
        <Text style={styles.bodyText}>
          Video recorded. Tap below to submit your evidence and report the no-show.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable
          style={[styles.primaryButtonOuter, isSubmitting && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={[colors.primary, '#8B7CF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryButtonLabel}>Submit evidence and report no-show</Text>
            )}
          </LinearGradient>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setRecordedUri(null)}>
          <Text style={styles.secondaryButtonLabel}>Record again</Text>
        </Pressable>
        <Text style={styles.captionText}>{VIDEO_NDPR_CONSENT}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} collapsable={false}>
      <View style={styles.infoBox}>
        <Text style={styles.captionText}>{VIDEO_CAMERA_PRE_PERMISSION}</Text>
      </View>

      <View style={styles.cameraWrap} collapsable={false}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="video" />
      </View>

      <Pressable
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <View style={[styles.recordButtonInner, isRecording && styles.recordButtonInnerActive]} />
      </Pressable>

      <Text style={styles.captionText}>
        {isRecording ? 'Recording... Tap to stop.' : 'Tap to start recording.'}
      </Text>
      <Text style={styles.captionText}>{VIDEO_NDPR_CONSENT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  cameraWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  infoBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.15)',
    backgroundColor: 'rgba(94,82,255,0.08)',
    padding: spacing.sm,
  },
  bodyText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.secondary,
  },
  captionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: fonts.medium,
    lineHeight: 18,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  recordButtonActive: { borderColor: colors.secondary },
  recordButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
  },
  recordButtonInnerActive: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  primaryButtonOuter: { borderRadius: 50, overflow: 'hidden' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  secondaryButton: {
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
});
