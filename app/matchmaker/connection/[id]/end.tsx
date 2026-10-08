import { MatchMakerEndConnectionSheet } from '@/components/matchmaker/MatchMakerEndConnectionSheet';
import { partnerUserId } from '@/lib/matchmaker/connection';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { MM } from '@/constants/matchmakerTheme';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

/** Deep-link fallback route; primary UX is the sheet on the connection screen. */
export default function MatchMakerEndConnectionScreen() {
  const { id: connectionId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { connection } = useMatchMakerConnection(connectionId);
  const [partnerName, setPartnerName] = useState('your match');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connection || !user?.id) return;
    const partnerId = partnerUserId(connection, user.id);
    void supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', partnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name?.trim()) setPartnerName(data.display_name.trim());
      });
  }, [connection, user?.id]);

  async function endConnection(reason: string) {
    if (!connectionId || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('matchmaker_end_connection', {
      p_connection_id: connectionId,
      p_reason: reason,
    });
    setBusy(false);
    if (error) return;
    router.replace('/matchmaker/reflect' as Href);
  }

  if (!connection) {
    return (
      <View style={{ flex: 1, backgroundColor: MM.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={MM.accent} />
      </View>
    );
  }

  return (
    <MatchMakerEndConnectionSheet
      visible
      partnerName={partnerName}
      busy={busy}
      onClose={() => router.back()}
      onConfirm={(reason) => void endConnection(reason)}
    />
  );
}
