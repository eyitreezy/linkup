/**
 * Bottom sheet: chat thread theme — color presets, wallpaper, text size & weight.
 */
import { colors, radius, spacing } from '@/constants/theme';
import {
  CHAT_APPEARANCE_PRESETS,
  CHAT_APPEARANCE_PRESET_ORDER,
  type ChatAppearancePresetId,
  type ChatAppearanceState,
  DEFAULT_CHAT_APPEARANCE,
  type ChatFontEmphasis,
  type ChatFontScale,
} from '@/lib/messaging/chatAppearance';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  value: ChatAppearanceState;
  onSave: (next: ChatAppearanceState) => void;
};

export function ChatAppearanceSheet({ visible, onClose, value, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ChatAppearanceState>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const pickWallpaper = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo access to set a chat background.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.92,
    });
    if (res.canceled || !res.assets[0]?.uri) return;
    setDraft((d) => ({ ...d, backgroundImageUri: res.assets[0].uri }));
  }, []);

  const apply = () => {
    onSave(draft);
    onClose();
  };

  const reset = () => {
    setDraft({ ...DEFAULT_CHAT_APPEARANCE });
  };

  const setPreset = (id: ChatAppearancePresetId) => setDraft((d) => ({ ...d, presetId: id }));

  const setFontScale = (fontScale: ChatFontScale) => setDraft((d) => ({ ...d, fontScale }));

  const setEmphasis = (fontEmphasis: ChatFontEmphasis) => setDraft((d) => ({ ...d, fontEmphasis }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
          ]}
        >
          <View style={styles.handleBar} accessibilityRole="none" />
          <Text style={styles.title}>Chat look</Text>
          <Text style={styles.sub}>Colors, wallpaper, and message text for this screen.</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>Theme</Text>
            <View style={styles.presetGrid}>
              {CHAT_APPEARANCE_PRESET_ORDER.map((id) => {
                const p = CHAT_APPEARANCE_PRESETS[id];
                const selected = draft.presetId === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setPreset(id)}
                    style={({ pressed }) => [
                      styles.presetCell,
                      selected && styles.presetCellSelected,
                      pressed && styles.presetCellPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Theme ${p.label}`}
                  >
                    <LinearGradient
                      colors={[p.threadGradient[0], p.threadGradient[2]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.presetSwatch}
                    />
                    <Text style={styles.presetLabel} numberOfLines={1}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Wallpaper</Text>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => void pickWallpaper()}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Choose background photo"
              >
                <Ionicons name="image-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnTxt}>Choose photo</Text>
              </Pressable>
              {draft.backgroundImageUri ? (
                <Pressable
                  onPress={() => setDraft((d) => ({ ...d, backgroundImageUri: null }))}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Remove wallpaper"
                >
                  <Text style={styles.secondaryBtnTxt}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>Message text</Text>
            <Text style={styles.hint}>Size and weight apply to bubbles and the composer field.</Text>
            <View style={styles.segmentRow}>
              {(['s', 'm', 'l'] as const).map((s) => {
                const active = draft.fontScale === s;
                const label = s === 's' ? 'Small' : s === 'm' ? 'Medium' : 'Large';
                return (
                  <Pressable
                    key={s}
                    onPress={() => setFontScale(s)}
                    style={[styles.segment, active && styles.segmentActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.segmentTxt, active && styles.segmentTxtActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.segmentRow}>
              {(['normal', 'bold'] as const).map((e) => {
                const active = draft.fontEmphasis === e;
                return (
                  <Pressable
                    key={e}
                    onPress={() => setEmphasis(e)}
                    style={[styles.segment, active && styles.segmentActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.segmentTxt, active && styles.segmentTxtActive]}>
                      {e === 'bold' ? 'Bold' : 'Regular'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable onPress={reset} style={styles.footerGhost} accessibilityRole="button">
              <Text style={styles.footerGhostTxt}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={apply}
              style={({ pressed }) => [styles.footerDone, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Save chat look"
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.footerDoneGrad}
              >
                <Text style={styles.footerDoneTxt}>Done</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15,23,42,0.12)',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingBottom: spacing.sm },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCell: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  presetCellSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  presetCellPressed: { opacity: 0.9 },
  presetSwatch: {
    height: 40,
    borderRadius: 10,
    marginBottom: 6,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.button,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(15,23,42,0.04)',
  },
  secondaryBtnTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(15,23,42,0.03)',
    alignItems: 'center',
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  segmentTxt: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  segmentTxtActive: { color: colors.text },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerGhost: { paddingVertical: 12, paddingHorizontal: 8 },
  footerGhostTxt: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  footerDone: { borderRadius: radius.button, overflow: 'hidden' },
  footerDoneGrad: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  footerDoneTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnPressed: { opacity: 0.88 },
});
