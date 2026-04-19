/**
 * Phone OTP — send SMS code and verify (Supabase Phone provider).
 */
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, radius, spacing } from '@/constants/theme';
import {
  normalizePhoneE164,
  requestPhoneOtp,
  verifyPhoneOtp,
} from '@/lib/authProviders';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onVerified: () => void;
  variant?: 'login' | 'signup';
  /** Omit inner card when already inside a shared auth card (dating layout). */
  noCard?: boolean;
};

export function PhoneAuthSection({ onVerified, variant = 'login', noCard }: Props) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const hint =
    process.env.EXPO_PUBLIC_PHONE_FORMAT_HINT ||
    'Use international format (e.g. +2348012345678) or local number with your default region.';

  const smsProviderFootnote = process.env.EXPO_PUBLIC_PHONE_SMS_PROVIDER_LABEL?.trim() ?? '';

  async function sendCode() {
    setErr('');
    const e164 = normalizePhoneE164(phone);
    if (e164.length < 10) {
      setErr('Enter a valid phone number');
      return;
    }
    setLoading(true);
    const { error } = await requestPhoneOtp(e164);
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  async function verify() {
    setErr('');
    const e164 = normalizePhoneE164(phone);
    if (otp.trim().length < 4) {
      setErr('Enter the code from SMS');
      return;
    }
    setLoading(true);
    const { error } = await verifyPhoneOtp(e164, otp);
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onVerified();
  }

  return (
    <View style={noCard ? styles.inline : styles.card}>
      <Text style={styles.cardTitle}>
        {variant === 'signup' ? 'Sign up with phone' : 'Sign in with phone'}
      </Text>
      <Text style={styles.hint}>{hint}</Text>
      {smsProviderFootnote ? <Text style={styles.footnote}>{smsProviderFootnote}</Text> : null}
      <Input
        label="Phone number"
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="+2348012345678"
        value={phone}
        onChangeText={setPhone}
        editable={!sent}
      />
      {!sent ? (
        <Button title="Send verification code" onPress={sendCode} loading={loading} pill />
      ) : (
        <>
          <Input
            label="6-digit code"
            keyboardType="number-pad"
            maxLength={8}
            value={otp}
            onChangeText={setOtp}
            placeholder="••••••"
          />
          <Button
            title={variant === 'signup' ? 'Verify & create account' : 'Verify & sign in'}
            onPress={verify}
            loading={loading}
            pill
          />
          <Pressable onPress={() => setSent(false)} accessibilityRole="button">
            <Text style={styles.resend}>Edit phone number</Text>
          </Pressable>
        </>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 18 },
  footnote: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 16,
    opacity: 0.9,
  },
  resend: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  err: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
