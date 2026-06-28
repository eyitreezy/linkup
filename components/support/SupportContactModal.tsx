/**
 * Inbox-grade support ticket modal — centered glass card (MeetTypeFormModal shell).
 */
import { Input } from '@/components/Input';
import { TierBadge } from '@/components/TierBadge';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  onClose: () => void;
  mode: 'standard' | 'concierge';
  subjectOptions: readonly string[];
  subject: string;
  onSelectSubject: (value: string) => void;
  body: string;
  onChangeBody: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
};

function modalMeta(mode: Props['mode']): { icon: IonName; kicker: string; title: string; subtitle: string } {
  if (mode === 'concierge') {
    return {
      icon: 'diamond-outline',
      kicker: 'Platinum',
      title: 'Concierge support',
      subtitle: 'Describe anything — a concierge agent will take it from here.',
    };
  }
  return {
    icon: 'chatbubble-ellipses-outline',
    kicker: 'Support',
    title: 'Contact support',
    subtitle: 'We’ll email you from the address on your account.',
  };
}

export function SupportContactModal({
  visible,
  onClose,
  mode,
  subjectOptions,
  subject,
  onSelectSubject,
  body,
  onChangeBody,
  submitting,
  onSubmit,
}: Props) {
  const meta = modalMeta(mode);
  const isConcierge = mode === 'concierge';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={submitting ? undefined : onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={submitting ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <KeyboardAvoidingView behavior="padding" style={styles.keyboardAvoid}>
          <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
            <LinearGradient
              colors={['rgba(94, 82, 255,0.45)', 'rgba(255, 74, 114,0.28)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ring}
            >
              <View style={styles.card}>
                <LinearGradient
                  colors={isConcierge ? ['#7C4DFF', '#5E35B1'] : [colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGrad}
                >
                  <Ionicons name={meta.icon} size={28} color="#fff" />
                </LinearGradient>

                {isConcierge ? (
                  <View style={styles.conciergeHead}>
                    <TierBadge tier="PLATINUM" compact />
                  </View>
                ) : null}

                <Text style={styles.kicker}>{meta.kicker}</Text>
                <Text style={styles.title}>{meta.title}</Text>
                <Text style={styles.message}>{meta.subtitle}</Text>
                {isConcierge ? (
                  <Text style={styles.sla}>We&apos;ll respond within 2 hours.</Text>
                ) : null}

                <ScrollView
                  style={styles.formScroll}
                  contentContainerStyle={styles.formScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {!isConcierge ? (
                    <>
                      <Text style={styles.fieldLabel}>Topic</Text>
                      <View style={styles.chipsRow}>
                        {subjectOptions.map((s) => {
                          const on = subject === s;
                          return (
                            <Pressable
                              key={s}
                              onPress={() => onSelectSubject(s)}
                              style={styles.chipHit}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                            >
                              {on ? (
                                <LinearGradient
                                  colors={[colors.primary, colors.secondary]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={styles.chipGrad}
                                >
                                  <Text style={styles.chipTxtOn}>{s}</Text>
                                </LinearGradient>
                              ) : (
                                <View style={styles.chipIdle}>
                                  <Text style={styles.chipTxt}>{s}</Text>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}

                  <Input
                    label={isConcierge ? 'What do you need?' : 'What’s going on?'}
                    variant="onboardingFlat"
                    multiline
                    value={body}
                    onChangeText={onChangeBody}
                    placeholder={
                      isConcierge
                        ? 'Tell us what you need — no topic required.'
                        : 'The more detail you share, the faster we can help.'
                    }
                    editable={!submitting}
                    style={styles.textarea}
                  />
                </ScrollView>

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={onClose}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      pressed && !submitting && styles.ctaPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                  >
                    <Text style={styles.secondaryTxt}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={onSubmit}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.ctaOuter,
                      pressed && !submitting && styles.ctaPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={isConcierge ? 'Send to concierge' : 'Submit ticket'}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaGrad}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.ctaTxt}>
                          {isConcierge ? 'Send to concierge' : 'Submit'}
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheetHit: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
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
    maxHeight: '88%',
  },
  iconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  conciergeHead: {
    marginBottom: spacing.sm,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  sla: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: '#5E35B1',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  formScroll: {
    alignSelf: 'stretch',
    maxHeight: 320,
  },
  formScrollContent: {
    paddingBottom: spacing.xs,
  },
  fieldLabel: {
    alignSelf: 'stretch',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chipHit: { borderRadius: radius.button, overflow: 'hidden' },
  chipGrad: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  chipIdle: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(94, 82, 255, 0.22)',
    backgroundColor: colors.authInputBg,
  },
  chipTxt: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  chipTxtOn: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: 'rgba(94, 82, 255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  secondaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  ctaOuter: {
    flex: 1,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
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
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
});
