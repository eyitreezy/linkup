import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

export default function DeleteAccountScreen() {
  const { user, signOut } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function wipe() {
    if (confirm !== 'DELETE') {
      Alert.alert('Confirm', 'Type DELETE in uppercase to confirm.');
      return;
    }
    if (!user || !isSupabaseConfigured) return;
    setBusy(true);
    const { error } = await supabase
      .from('users')
      .update({ account_status: 'suspended', subscription_status: 'expired' })
      .eq('id', user.id);
    setBusy(false);
    if (error) Alert.alert('Error', error.message);
    else {
      await supabase.from('profiles').update({ is_profile_public: false }).eq('user_id', user.id);
      Alert.alert('Account suspended', 'Your session will end. Contact support for full data deletion per policy.');
      await signOut();
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.warn}>
        This suspends your account and hides your profile. Full retention and purge follow your privacy policy and may
        require support.
      </Text>
      <Text style={styles.label}>Type DELETE to confirm</Text>
      <Input value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
      <Button title="Delete my account" variant="secondary" onPress={() => void wipe()} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  warn: {
    fontSize: 15,
    color: colors.danger,
    lineHeight: 22,
    marginBottom: spacing.lg,
    fontWeight: '600',
  },
  label: { fontSize: 14, fontWeight: '700', marginBottom: spacing.sm, color: colors.text },
});
