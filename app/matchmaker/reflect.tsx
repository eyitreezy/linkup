import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { supabase } from '@/lib/supabase';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

export default function MatchMakerReflectScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [day, setDay] = useState(1);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('matchmaker_connections')
      .select('ended_at')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .eq('status', 'ended')
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.ended_at) return;
        const days = Math.floor((Date.now() - new Date(data.ended_at).getTime()) / 86400000);
        if (days >= 6) router.replace('/matchmaker/reentry' as Href);
        else if (days >= 3) router.replace('/matchmaker/heal' as Href);
        else setDay(Math.max(1, days + 1));
      });
  }, [user?.id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: MM.bg }} contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
      <Text style={styles.title}>Take a moment.</Text>
      <Text style={styles.body}>Reflect on what you experienced. We will be here when you are ready.</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>What did you learn from this connection?</Text>
        <TextInput value={text} onChangeText={setText} multiline style={styles.input} placeholder="Private reflection" placeholderTextColor={MM.muted} />
        <Pressable onPress={() => setText('')} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <Text style={styles.progress}>Reflection period · Day {day} of 3</Text>
      <Text style={styles.note}>All other LinkUp features remain available as normal.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold, color: MM.text, textAlign: 'center' },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', lineHeight: 22 },
  card: { marginTop: spacing.xl, backgroundColor: MM.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: MM.border, padding: spacing.md },
  cardLabel: { fontFamily: fonts.medium, color: MM.text, marginBottom: spacing.sm },
  input: { minHeight: 100, textAlignVertical: 'top', fontFamily: fonts.regular, color: MM.text },
  skip: { marginTop: spacing.sm, alignSelf: 'flex-end' },
  skipText: { color: MM.muted, fontFamily: fonts.regular },
  progress: { marginTop: spacing.lg, textAlign: 'center', color: MM.muted, fontFamily: fonts.regular },
  note: { marginTop: spacing.sm, textAlign: 'center', color: MM.muted, fontSize: 12, fontFamily: fonts.regular },
});
