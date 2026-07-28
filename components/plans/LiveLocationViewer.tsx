import { colors, radius, spacing, fonts } from '@/constants/theme';
import { getMapsApiKeyForCurrentPlatform } from '@/lib/mapsConfig';
import { removeSupabaseChannel, supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  partnerSessionId: string | null;
};

export function LiveLocationViewer({ partnerSessionId }: Props) {
  const [latestPing, setLatestPing] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!partnerSessionId) {
      setLatestPing(null);
      return;
    }

    void supabase
      .from('live_location_pings')
      .select('lat, lng')
      .eq('session_id', partnerSessionId)
      .order('pinged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLatestPing({ lat: data.lat, lng: data.lng });
      });

    const channel = supabase
      .channel(`mobile-pings-${partnerSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_location_pings',
          filter: `session_id=eq.${partnerSessionId}`,
        },
        (payload) => {
          const row = payload.new as { lat?: number; lng?: number };
          if (typeof row.lat === 'number' && typeof row.lng === 'number') {
            setLatestPing({ lat: row.lat, lng: row.lng });
          }
        }
      )
      .subscribe();

    return () => {
      removeSupabaseChannel(channel);
    };
  }, [partnerSessionId]);

  if (!partnerSessionId || !latestPing) return null;

  const mapsKey = getMapsApiKeyForCurrentPlatform();
  const staticMapUrl = mapsKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latestPing.lat},${latestPing.lng}&zoom=16&size=400x200&markers=${latestPing.lat},${latestPing.lng}&key=${mapsKey}`
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.caption}>Your partner is sharing their live location</Text>
      {staticMapUrl ? (
        <Image source={{ uri: staticMapUrl }} style={styles.map} resizeMode="cover" />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderText}>
            Map preview unavailable. Location: {latestPing.lat.toFixed(5)},{' '}
            {latestPing.lng.toFixed(5)}
          </Text>
        </View>
      )}
      <Text style={styles.subcaption}>
        Location updates every few seconds. Only visible to you.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: 'rgba(94,82,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(94,82,255,0.15)',
  },
  caption: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  map: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  mapPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  placeholderText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  subcaption: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
});
