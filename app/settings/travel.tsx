import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const PRESETS = [
  { label: 'Lagos', latitude: 6.5244, longitude: 3.3792 },
  { label: 'Abuja', latitude: 9.0765, longitude: 7.3986 },
  { label: 'Port Harcourt', latitude: 4.8156, longitude: 7.0498 },
];

export default function TravelModeScreen() {
  const { user, profile, dbUser, refreshProfile } = useAuth();
  const premium = isPremiumSubscriber(dbUser);
  const tm = profile?.preferences?.travel_mode;
  const [label, setLabel] = useState(tm?.label ?? '');
  const [lat, setLat] = useState(tm?.latitude?.toString() ?? '');
  const [lng, setLng] = useState(tm?.longitude?.toString() ?? '');

  useEffect(() => {
    setLabel(tm?.label ?? '');
    setLat(tm?.latitude?.toString() ?? '');
    setLng(tm?.longitude?.toString() ?? '');
  }, [tm?.label, tm?.latitude, tm?.longitude]);

  async function save(next: { label: string; latitude: number; longitude: number } | null) {
    if (!user || !isSupabaseConfigured) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        preferences: {
          ...(profile?.preferences ?? {}),
          travel_mode: next,
        },
      })
      .eq('user_id', user.id);
    if (error) Alert.alert('Error', error.message);
    else {
      await refreshProfile();
      Alert.alert('Saved', next ? `Browsing near ${next.label}` : 'Travel mode off');
    }
  }

  if (!premium) {
    return (
      <Screen scroll>
        <Text style={styles.p}>Travel mode is a Premium feature — browse plans as if you were in another city.</Text>
        <Button title="See Premium" onPress={() => router.push('/premium' as Href)} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.p}>Pick a preset or enter coordinates. The Plans tab uses this location while travel mode is set.</Text>
      {PRESETS.map((p) => (
        <Button
          key={p.label}
          title={p.label}
          variant="secondary"
          onPress={() => void save({ label: p.label, latitude: p.latitude, longitude: p.longitude })}
          style={{ marginBottom: spacing.sm }}
        />
      ))}
      <Input label="Custom label" value={label} onChangeText={setLabel} />
      <Input label="Latitude" keyboardType="decimal-pad" value={lat} onChangeText={setLat} />
      <Input label="Longitude" keyboardType="decimal-pad" value={lng} onChangeText={setLng} />
      <Button
        title="Save custom"
        onPress={() => {
          const la = Number(lat);
          const lo = Number(lng);
          if (!label.trim() || Number.isNaN(la) || Number.isNaN(lo)) {
            Alert.alert('Travel', 'Enter label, latitude, and longitude.');
            return;
          }
          void save({ label: label.trim(), latitude: la, longitude: lo });
        }}
      />
      <Button title="Clear travel mode" variant="ghost" onPress={() => void save(null)} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.md },
});
