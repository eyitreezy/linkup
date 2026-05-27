import { Button } from '@/components/Button';
import { KycLeadBlock } from '@/components/kyc/KycLeadBlock';
import { KycSectionHead } from '@/components/kyc/KycSectionHead';
import { KycStepFooter } from '@/components/kyc/KycStepFooter';
import { kycColors, kycInboxStyles, kycStyles } from '@/components/kyc/kycTheme';
import { colors, radius, spacing } from '@/constants/theme';
import { countryCodeToFlagEmoji } from '@/lib/kyc/countryFlagEmoji';
import { idCaptureInstruction, idCaptureTitle } from '@/lib/kyc/documentTypeCopy';
import { KYC_COUNTRY_OPTIONS, type KycDocumentType } from '@/types/kyc';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  documentType: KycDocumentType;
  countryCode: string | null;
  onCountryChange: (code: string) => void;
  idUri: string | null;
  onIdChange: (uri: string | null) => void;
  onBack: () => void;
  onNext: () => void;
};

export function K2IdCapture({
  documentType,
  countryCode,
  onCountryChange,
  idUri,
  onIdChange,
  onBack,
  onNext,
}: Props) {
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return KYC_COUNTRY_OPTIONS;
    return KYC_COUNTRY_OPTIONS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countryQuery]);

  const selectedCountry = KYC_COUNTRY_OPTIONS.find((c) => c.code === countryCode);

  async function pickFromLibrary() {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (!r.canceled && r.assets[0]) onIdChange(r.assets[0].uri);
    } catch (e) {
      Alert.alert(
        'Upload failed',
        'Could not open your photo library. Check permissions and try again.',
        [{ text: 'OK' }]
      );
      if (__DEV__) console.warn(e);
    }
  }

  async function capturePhoto() {
    if (!camRef.current || !ready) return;
    setCapturing(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (photo?.uri) onIdChange(photo.uri);
    } catch {
      Alert.alert('Capture failed', 'Try again, or upload a photo from your library instead.', [
        { text: 'Upload', onPress: () => void pickFromLibrary() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setCapturing(false);
    }
  }

  const canNext = !!countryCode && !!idUri;

  function selectCountry(code: string) {
    onCountryChange(code);
    setCountryModalOpen(false);
    setCountryQuery('');
  }

  function closeCountryModal() {
    setCountryModalOpen(false);
    setCountryQuery('');
  }

  return (
    <View style={kycStyles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={kycInboxStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        <KycLeadBlock
          kicker="Identity"
          title={idCaptureTitle(documentType)}
          subtitle={idCaptureInstruction(documentType)}
        />
        <KycSectionHead title="Issuing country" />
        <Pressable
          style={({ pressed }) => [styles.countryTrigger, pressed && styles.countryTriggerPressed]}
          onPress={() => setCountryModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose country or region"
        >
          <View style={styles.countryTriggerLeft}>
            <Text style={styles.countryTriggerFlag}>
              {selectedCountry ? countryCodeToFlagEmoji(selectedCountry.code) : '\u{1F30D}'}
            </Text>
            <Text
              style={[styles.countryTriggerLabel, !selectedCountry && styles.countryTriggerPlaceholder]}
              numberOfLines={1}
            >
              {selectedCountry?.label ?? 'Select your country'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={22} color={kycColors.muted} />
        </Pressable>

        <KycSectionHead title="Document photo" />
        <Text style={styles.captureHint}>
          Position your document in the frame — avoid glare. We use this only to verify you; it is never shown on your
          profile.
        </Text>

        <View style={kycInboxStyles.frostedCard}>
          <View style={styles.previewBox}>
            {idUri ? (
              <Image source={{ uri: idUri }} style={styles.previewImg} resizeMode="cover" />
            ) : camPerm?.granted ? (
              <View style={styles.camWrap}>
                <CameraView
                  ref={camRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  mode="picture"
                  onCameraReady={() => setReady(true)}
                />
                <View style={styles.overlayFrame} pointerEvents="none">
                  <View style={styles.frame} />
                </View>
              </View>
            ) : (
              <View style={styles.permBox}>
                <LinearGradient
                  colors={['rgba(108,99,255,0.16)', 'rgba(255,101,132,0.08)']}
                  style={styles.permIconWrap}
                >
                  <Ionicons name="scan-outline" size={36} color={kycColors.primary} />
                </LinearGradient>
                <Text style={styles.permText}>Camera access helps you scan your ID in one tap.</Text>
                <Button title="Allow camera" onPress={() => void requestCam()} />
              </View>
            )}
          </View>
        </View>

        <View style={styles.btnRow}>
          {idUri ? (
            <Button title="Retake" variant="secondary" onPress={() => onIdChange(null)} />
          ) : (
            <>
              <Button title={capturing ? 'Capturing…' : 'Capture'} onPress={capturePhoto} disabled={capturing} />
              <Button title="Upload instead" variant="ghost" onPress={pickFromLibrary} />
            </>
          )}
        </View>
        {capturing ? <ActivityIndicator color={kycColors.primary} style={{ marginTop: spacing.sm }} /> : null}
      </ScrollView>

      <KycStepFooter onBack={onBack} onContinue={onNext} continueDisabled={!canNext} />

      <Modal visible={countryModalOpen} animationType="slide" transparent onRequestClose={closeCountryModal}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeCountryModal} accessibilityLabel="Close country list" />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.modalGrabber} />
            <View style={styles.modalHeader}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.modalAccent}
              />
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Country / region</Text>
                <Text style={styles.modalHint}>Choose where your ID was issued</Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={20} color={kycColors.muted} style={styles.searchIcon} />
              <TextInput
                value={countryQuery}
                onChangeText={setCountryQuery}
                placeholder="Search countries"
                placeholderTextColor={kycColors.muted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {countryQuery.length > 0 ? (
                <Pressable onPress={() => setCountryQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={kycColors.muted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.countryList}
              contentContainerStyle={styles.countryListContent}
              ItemSeparatorComponent={() => <View style={styles.countrySep} />}
              renderItem={({ item }) => {
                const selected = item.code === countryCode;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.countryRow,
                      selected && styles.countryRowOn,
                      pressed && { opacity: 0.92 },
                    ]}
                    onPress={() => selectCountry(item.code)}
                  >
                    <Text style={styles.countryRowFlag}>{countryCodeToFlagEmoji(item.code)}</Text>
                    <Text style={styles.countryRowLabel}>{item.label}</Text>
                    <Text style={styles.countryRowCode}>{item.code}</Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={kycColors.primary} />
                    ) : (
                      <View style={{ width: 22 }} />
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyCountries}>{`No countries match "${countryQuery}"`}</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  captureHint: {
    fontSize: 14,
    color: kycColors.muted,
    lineHeight: 20,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    fontWeight: '600',
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    borderRadius: radius.xl,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  countryTriggerPressed: { opacity: 0.96 },
  countryTriggerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 12 },
  countryTriggerFlag: { fontSize: 28, lineHeight: 32 },
  countryTriggerLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: kycColors.text },
  countryTriggerPlaceholder: { color: kycColors.muted, fontWeight: '600' },
  previewBox: {
    height: 256,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#E8EAEF',
    margin: -spacing.xs,
  },
  camWrap: { flex: 1 },
  overlayFrame: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: '88%',
    height: '72%',
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  previewImg: { width: '100%', height: '100%' },
  permBox: { flex: 1, justifyContent: 'center', padding: spacing.lg, alignItems: 'center' },
  permIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permText: {
    textAlign: 'center',
    color: kycColors.muted,
    marginBottom: spacing.lg,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
    fontWeight: '600',
  },
  btnRow: { gap: spacing.sm, marginBottom: spacing.md, paddingHorizontal: spacing.md },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26, 29, 38, 0.45)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '78%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  modalGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(108, 99, 255, 0.25)',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalAccent: { width: 5, height: 44, borderRadius: 3 },
  modalHeaderText: { flex: 1 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: kycColors.text, letterSpacing: -0.3 },
  modalHint: { fontSize: 14, color: kycColors.muted, marginTop: 4, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: kycColors.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontWeight: '600',
  },
  countryList: { maxHeight: 380 },
  countryListContent: { paddingBottom: spacing.sm },
  countrySep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(108, 99, 255, 0.1)' },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
  },
  countryRowOn: { backgroundColor: 'rgba(108, 99, 255, 0.08)' },
  countryRowFlag: { fontSize: 26, width: 40, textAlign: 'center' },
  countryRowLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: kycColors.text },
  countryRowCode: {
    fontSize: 13,
    fontWeight: '700',
    color: kycColors.muted,
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
  emptyCountries: {
    textAlign: 'center',
    color: kycColors.muted,
    paddingVertical: spacing.xl,
    fontSize: 15,
    fontWeight: '600',
  },
});
