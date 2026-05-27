import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { AppFeedbackModal } from '@/components/ui/AppFeedbackModal';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const CONFIRM_PHRASE = 'DELETE';

export default function DeleteAccountScreen() {
  const { user, signOut } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const canSubmit = confirm.trim() === CONFIRM_PHRASE;

  async function performDelete() {
    if (!user || !isSupabaseConfigured) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ account_status: 'suspended', subscription_status: 'expired' })
        .eq('id', user.id);
      if (error) {
        setFeedback({ variant: 'error', title: 'Could not delete', message: error.message });
        return;
      }
      await supabase.from('profiles').update({ is_profile_public: false }).eq('user_id', user.id);
      setConfirmModalOpen(false);
      setFeedback({
        variant: 'success',
        title: 'Account suspended',
        message:
          'Your profile is hidden and your session will end. Contact support if you need full data deletion under our privacy policy.',
      });
    } finally {
      setBusy(false);
    }
  }

  function onPressDelete() {
    if (!canSubmit) {
      setFeedback({
        variant: 'error',
        title: 'Confirmation required',
        message: `Type ${CONFIRM_PHRASE} in uppercase exactly as shown to continue.`,
      });
      return;
    }
    setConfirmModalOpen(true);
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']} safeAreaStyle={styles.screenRoot}>
      <View style={styles.flex}>
        <LinearGradient
          colors={['#EDE8FF', '#FFF0F5', '#E8FAF4', colors.discoveryGradientBottom]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.topNav}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.leadBlock}>
            <LinearGradient
              colors={[colors.danger, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leadAccent}
            />
            <View style={styles.leadTextCol}>
              <Text style={styles.leadKicker}>Account</Text>
              <Text style={styles.leadTitle}>Delete account</Text>
              <Text style={styles.leadSub}>
                This is permanent for everyday use — your profile is hidden and you won&apos;t be able to sign in
                again with this account.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View style={[styles.sectionAccentDot, styles.sectionAccentDotDanger]} />
              <Text style={styles.sectionTitle}>Before you continue</Text>
            </View>
            <LinearGradient
              colors={['rgba(239,68,68,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <LinearGradient
            colors={['rgba(239,68,68,0.14)', 'rgba(255,101,132,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardOuter}
          >
            <View style={styles.warnCardInner}>
              <LinearGradient colors={[colors.danger, '#F87171']} style={styles.warnIconGrad}>
                <Ionicons name="warning-outline" size={26} color="#fff" />
              </LinearGradient>
              <Text style={styles.warnTitle}>What happens</Text>
              <Text style={styles.warnBody}>
                Your account is suspended, your profile is hidden from Discover and messages, and premium access ends.
                Full data retention and purge follow our privacy policy and may require contacting support.
              </Text>
            </View>
          </LinearGradient>

          <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionAccentDot} />
              <Text style={styles.sectionTitle}>Confirm</Text>
            </View>
            <LinearGradient
              colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionRule}
            />
          </View>

          <LinearGradient
            colors={['rgba(108,99,255,0.18)', 'rgba(255,101,132,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardOuter}
          >
            <View style={styles.formCardInner}>
              <Text style={styles.fieldLabel}>
                Type <Text style={styles.fieldLabelEmphasis}>{CONFIRM_PHRASE}</Text> to confirm
              </Text>
              <Input
                value={confirm}
                onChangeText={setConfirm}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={CONFIRM_PHRASE}
                placeholderTextColor={colors.textMuted}
                variant="onboardingFlat"
              />
              <Pressable
                onPress={onPressDelete}
                disabled={busy}
                style={({ pressed }) => [
                  styles.deleteCtaOuter,
                  !canSubmit && styles.deleteCtaDisabled,
                  pressed && canSubmit && !busy && styles.deleteCtaPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Delete my account"
                accessibilityState={{ disabled: !canSubmit || busy }}
              >
                <LinearGradient
                  colors={
                    canSubmit
                      ? [colors.danger, colors.secondary]
                      : ['rgba(239,68,68,0.35)', 'rgba(255,101,132,0.35)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.deleteCtaGrad}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.deleteCtaTxt}>Delete my account</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>

          <Text style={styles.note}>
            Changed your mind? Go back — nothing changes until you confirm and complete deletion.
          </Text>
        </ScrollView>
      </View>

      <AppConfirmModal
        visible={confirmModalOpen}
        onClose={() => !busy && setConfirmModalOpen(false)}
        kicker="Account"
        title="Delete your account?"
        message="You won't be able to use LinkUp with this account after this step. This cannot be undone from the app."
        iconVariant="danger"
        primaryLabel="Keep account"
        onPrimary={() => setConfirmModalOpen(false)}
        secondaryLabel="Yes, delete"
        onSecondary={() => void performDelete()}
        secondaryTone="danger"
        busyOn="secondary"
        dismissOnBackdrop={!busy}
      />

      <AppFeedbackModal
        visible={feedback != null}
        onClose={() => {
          if (feedback?.variant === 'success') {
            setFeedback(null);
            void signOut();
          } else {
            setFeedback(null);
          }
        }}
        variant={feedback?.variant ?? 'warning'}
        kicker="Account"
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        primaryLabel={feedback?.variant === 'success' ? 'Sign out' : 'OK'}
        onPrimary={() => {
          if (feedback?.variant === 'success') {
            setFeedback(null);
            void signOut();
          } else {
            setFeedback(null);
          }
        }}
        dismissOnBackdrop={feedback?.variant !== 'success'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl * 2 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 52,
  },
  leadTextCol: { flex: 1, minWidth: 0 },
  leadKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leadTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  leadSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  sectionHead: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionHeadSpaced: {
    marginTop: spacing.md,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sectionAccentDotDanger: {
    backgroundColor: colors.danger,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  cardOuter: {
    borderRadius: radius.xl,
    padding: 2,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  warnCardInner: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  warnIconGrad: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  warnTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  warnBody: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  formCardInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl - 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.15,
  },
  fieldLabelEmphasis: {
    fontWeight: '900',
    color: colors.danger,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }),
  },
  deleteCtaOuter: {
    marginTop: spacing.md,
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  deleteCtaDisabled: {
    opacity: 0.65,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  deleteCtaPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  deleteCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  deleteCtaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  note: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
