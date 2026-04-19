/**
 * Media viewer — resolves Storage path from `media` row (signed URL for private buckets).
 */
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/theme';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';

export default function MediaViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id || !isSupabaseConfigured) return;
      const { data } = await supabase.from('media').select('*').eq('id', id).single();
      if (!data) return;
      const bucket = data.storage_bucket as string;
      const path = data.storage_path as string;
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      setUrl(signed?.signedUrl ?? null);
    })();
  }, [id]);

  if (!url) {
    return (
      <Screen safeAreaEdges={['top', 'left', 'right']}>
        <Text style={{ color: colors.textMuted }}>Loading media…</Text>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['top', 'left', 'right']}>
      <Image source={{ uri: url }} style={styles.img} resizeMode="contain" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', height: '80%' },
});
