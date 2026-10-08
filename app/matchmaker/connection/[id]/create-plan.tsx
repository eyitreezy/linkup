import { Button } from '@/components/Button';
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { useMatchMakerConnection } from '@/hooks/useMatchMakerConnection';
import { partnerUserId } from '@/lib/matchmaker/connection';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function MatchMakerPlanProposalScreen() {
  const { id: connectionId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { connection } = useMatchMakerConnection(connectionId);
  const [partnerName, setPartnerName] = useState('your match');

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

  function startPlanWizard() {
    if (!connectionId || !connection || !user?.id) return;
    const partnerId = partnerUserId(connection, user.id);
    router.push({
      pathname: '/plan/create',
      params: {
        matchmaker_connection_id: connectionId,
        matchmaker_counterparty_id: partnerId,
      },
    } as Href);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={MM.text} />
      </Pressable>
      <View style={styles.hero}>
        <Ionicons name="heart-circle" size={48} color={MM.accent} />
        <Text style={styles.title}>Propose a meetup</Text>
        <Text style={styles.body}>
          Set the details. {partnerName} reviews and agrees before anything is confirmed or charged.
        </Text>
      </View>
      <Button title="Continue to plan details" onPress={() => void startPlanWizard()} gradient pill fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg, paddingHorizontal: spacing.lg },
  back: { marginBottom: spacing.md },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 22, fontFamily: fonts.bold, color: MM.text, textAlign: 'center' },
  body: { fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', lineHeight: 22 },
});
