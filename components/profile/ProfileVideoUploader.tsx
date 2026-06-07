import { authSoftLabelStyle } from '@/components/Input';
import { KycLivenessVideoPreview } from '@/components/kyc/KycLivenessVideoPreview';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  localUri: string | null;
  remoteUrl: string | null;
  onPickLocal: (uri: string) => void;
  onRemove: () => void;
  required?: boolean;
};

export function ProfileVideoUploader({ localUri, remoteUrl, onPickLocal, onRemove, required }: Props) {
  const previewUri = localUri ?? remoteUrl;

  async function pickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    onPickLocal(res.assets[0].uri);
  }

  return (
    <View style={styles.wrap}>
      <Text style={[authSoftLabelStyle, styles.labelSpacing]}>Profile video{required ? ' *' : ''}</Text>
      <Text style={styles.hint}>One short intro clip (5–30 sec). MP4, MOV, or WebM.</Text>

      {previewUri ? (
        <View style={styles.previewCard}>
          <KycLivenessVideoPreview uri={previewUri} style={styles.video} mirror={false} />
          <View style={styles.actions}>
            <Pressable onPress={pickVideo} style={styles.actionBtn}>
              <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
              <Text style={styles.actionTxt}>Replace</Text>
            </Pressable>
            <Pressable onPress={onRemove} style={[styles.actionBtn, styles.actionDanger]}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.actionTxt, styles.actionDangerTxt]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={pickVideo} style={({ pressed }) => [styles.addOuter, pressed && styles.addPressed]}>
          <LinearGradient
            colors={['rgba(108,99,255,0.12)', 'rgba(255,101,132,0.08)']}
            style={styles.addInner}
          >
            <Ionicons name="videocam-outline" size={32} color={colors.primary} />
            <Text style={styles.addTitle}>Upload video</Text>
            <Text style={styles.addSub}>Show your vibe — one clip only</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: onboarding.spacing.lg },
  labelSpacing: { marginBottom: 4 },
  hint: { fontSize: 12, color: onboarding.muted, marginBottom: onboarding.spacing.md, lineHeight: 18 },
  previewCard: {
    borderRadius: onboarding.radius2xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.18)',
    backgroundColor: '#fff',
  },
  video: { width: '100%', height: 220, backgroundColor: '#0F172A' },
  actions: { flexDirection: 'row', gap: 10, padding: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  actionTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },
  actionDanger: { backgroundColor: 'rgba(239,68,68,0.08)' },
  actionDangerTxt: { color: colors.danger },
  addOuter: { borderRadius: onboarding.radius2xl, overflow: 'hidden' },
  addPressed: { opacity: 0.92 },
  addInner: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
    borderRadius: onboarding.radius2xl,
    borderStyle: 'dashed',
  },
  addTitle: { marginTop: 8, fontSize: 15, fontWeight: '900', color: colors.text },
  addSub: { marginTop: 4, fontSize: 12, fontWeight: '600', color: onboarding.muted },
});
