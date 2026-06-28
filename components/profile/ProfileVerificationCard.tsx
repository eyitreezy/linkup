/**
 * Verification summary card — profile hub (linkup-web parity).
 */
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { isUserVerified } from '@/lib/verification/access';
import type { UserVerification } from '@/types/database';
import { Href, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type VerificationUiStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

type Props = {
  verificationStatus?: UserVerification;
};

function toUiStatus(status?: UserVerification): VerificationUiStatus {
  if (status === 'verified' || status === 'pending' || status === 'rejected') return status;
  return 'unverified';
}

function statusValue(status: VerificationUiStatus): string {
  if (status === 'verified') return 'On';
  if (status === 'pending') return 'Pending';
  if (status === 'rejected') return 'Retry';
  return 'Off';
}

function statusHint(status: VerificationUiStatus): string {
  if (status === 'verified') return 'Others see your badge on plans and messages';
  if (status === 'pending') return 'We are checking your documents. You will get an update soon.';
  if (status === 'rejected') return 'Submit clearer documents if you would like to try again.';
  return 'Complete verification to unlock plans, offers, and escrow.';
}

function ctaLabel(status: VerificationUiStatus): string {
  if (status === 'verified') return 'Trust center';
  if (status === 'pending') return 'View status';
  return 'Get verified';
}

function shellColors(status: VerificationUiStatus): [string, string] {
  if (status === 'verified') return ['#34D399', '#14B8A6'];
  if (status === 'pending') return ['#FBBF24', '#FB923C'];
  if (status === 'rejected') return ['#F87171', '#FB7185'];
  return [colors.primary, colors.secondary];
}

function innerColors(status: VerificationUiStatus): [string, string, string] {
  if (status === 'verified') return ['rgba(236,253,245,0.95)', '#FFFFFF', 'rgba(204,251,241,0.7)'];
  if (status === 'pending') return ['rgba(255,251,235,0.95)', '#FFFFFF', 'rgba(254,243,199,0.6)'];
  if (status === 'rejected') return ['rgba(254,242,242,0.95)', '#FFFFFF', 'rgba(255,228,230,0.6)'];
  return ['#FFFFFF', '#F8F4FF', '#FFD1E3'];
}

function iconName(status: VerificationUiStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'verified') return 'shield-checkmark';
  if (status === 'pending') return 'time-outline';
  if (status === 'rejected') return 'close-circle-outline';
  return 'shield-outline';
}

function valueColor(status: VerificationUiStatus): string {
  if (status === 'verified') return '#047857';
  if (status === 'pending') return '#B45309';
  return colors.text;
}

export function ProfileVerificationCard({ verificationStatus }: Props) {
  const uiStatus = toUiStatus(verificationStatus);
  const verified = isUserVerified(verificationStatus);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/settings/verification' as Href)}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <LinearGradient colors={shellColors(uiStatus)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shell}>
        <LinearGradient
          colors={innerColors(uiStatus)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inner}
        >
          <View style={styles.row}>
            <LinearGradient
              colors={shellColors(uiStatus)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconShell}
            >
              <Ionicons name={iconName(uiStatus)} size={26} color="#fff" />
            </LinearGradient>

            <View style={styles.copy}>
              <View style={styles.labelRow}>
                <Text style={styles.kicker}>Verification</Text>
                <View style={[styles.statusPill, verified ? styles.statusPillOn : styles.statusPillOff]}>
                  <Text style={[styles.statusPillTxt, verified ? styles.statusPillTxtOn : styles.statusPillTxtOff]}>
                    {verificationStatus ?? 'unverified'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.value, { color: valueColor(uiStatus) }]}>{statusValue(uiStatus)}</Text>
              <Text style={styles.hint}>{statusHint(uiStatus)}</Text>
            </View>

            <View style={styles.ctaChip}>
              <Text style={styles.ctaTxt}>{ctaLabel(uiStatus)}</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.995 }] },
  shell: {
    borderRadius: radius.xl,
    padding: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  inner: {
    borderRadius: radius.xl - 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconShell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  statusPillOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  statusPillOff: {
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
    borderColor: 'rgba(94, 82, 255, 0.18)',
  },
  statusPillTxt: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: fonts.bold,
    textTransform: 'capitalize',
  },
  statusPillTxtOn: { color: colors.success },
  statusPillTxtOff: { color: colors.primary },
  value: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },
  ctaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  ctaTxt: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
