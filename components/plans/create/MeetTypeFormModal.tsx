/**
 * Create / edit custom meet type — inbox-grade centered modal (AppConfirmModal shell).
 */
import { colors, radius, spacing } from '@/constants/theme';
import type { MeetTypeIonIcon } from '@/lib/plans/inferMeetTypeIcon';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const FIELD_BORDER = '#D8DCE6';

type Props = {
  visible: boolean;
  mode: 'create' | 'edit';
  name: string;
  onChangeName: (value: string) => void;
  previewIcon: MeetTypeIonIcon;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function MeetTypeFormModal({
  visible,
  mode,
  name,
  onChangeName,
  previewIcon,
  saving,
  onClose,
  onSave,
}: Props) {
  const isCreate = mode === 'create';
  const title = isCreate ? 'New meet type' : 'Edit meet type';
  const subtitle = isCreate
    ? "We'll pick an icon from your title."
    : 'Update the title — the icon updates automatically.';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={saving ? undefined : onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={saving ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.45)', 'rgba(255,101,132,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            <View style={styles.card}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGrad}
              >
                <Ionicons
                  name={isCreate ? 'add-circle-outline' : 'pencil-outline'}
                  size={28}
                  color="#fff"
                />
              </LinearGradient>

              <Text style={styles.kicker}>Meet types</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{subtitle}</Text>

              <View style={styles.previewRow}>
                <LinearGradient
                  colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.08)']}
                  style={styles.previewIconWrap}
                >
                  <Ionicons name={previewIcon} size={26} color={colors.primary} />
                </LinearGradient>
                <View style={styles.previewText}>
                  <Text style={styles.previewLabel}>Preview icon</Text>
                  <Text style={styles.previewHint}>Updates as you type</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Meet type name</Text>
              <TextInput
                value={name}
                onChangeText={onChangeName}
                placeholder="e.g. Board games night"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCorrect
                autoCapitalize="sentences"
                editable={!saving}
              />

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={onClose}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && !saving && styles.ctaPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.secondaryTxt}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={onSave}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.ctaOuter,
                    pressed && !saving && styles.ctaPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={isCreate ? 'Create meet type' : 'Save meet type'}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaGrad}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.ctaTxt}>{isCreate ? 'Create' : 'Save'}</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheetHit: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  iconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
  },
  previewIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { flex: 1 },
  previewLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  previewHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  fieldLabel: {
    alignSelf: 'stretch',
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.authInputBg,
    marginBottom: spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
    alignItems: 'center',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(108,99,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  secondaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  ctaOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  ctaGrad: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  ctaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
});
