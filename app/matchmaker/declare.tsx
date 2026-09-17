import { MM, MM_CTA_GRADIENT, MM_CTA_GRADIENT_LOCATIONS, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerDeclareScreen() {
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    if (!checked || busy) return;
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    await supabase.from('matchmaker_intents').upsert({
      user_id: user.user.id,
      declared_at: new Date().toISOString(),
      is_active: true,
    });
    setBusy(false);
    router.replace('/matchmaker/values' as Href);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: MM.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
    >
      <Ionicons name="heart-circle" size={56} color={MM.accent} style={{ alignSelf: 'center' }} />
      <Text style={styles.title}>Before you enter MatchMaker</Text>
      <Text style={styles.body}>
        MatchMaker is built for one purpose: to help serious-minded individuals find a long-term relationship with the potential for marriage.
      </Text>
      <Text style={styles.body}>
        It is not a casual dating feature, a friendship finder, or an exploratory social tool.
      </Text>
      <View style={styles.quoteCard}>
        <Text style={styles.quote}>One person. One connection. One intention.</Text>
      </View>
      <Pressable onPress={() => setChecked((v) => !v)} style={styles.checkRow}>
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        <Text style={styles.checkCopy}>
          I am entering MatchMaker with the sincere intention of finding a long-term relationship with the potential for marriage.
        </Text>
      </Pressable>
      <Pressable disabled={!checked || busy} onPress={() => void onConfirm()} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
        <LinearGradient
          colors={checked ? [...MM_CTA_GRADIENT] : [MM.disabled, MM.disabled]}
          locations={[...MM_CTA_GRADIENT_LOCATIONS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{busy ? 'Saving…' : 'I confirm this declaration'}</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>Go back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg },
  title: { marginTop: spacing.lg, fontSize: 24, fontFamily: fonts.bold, fontWeight: '800', color: MM.text, textAlign: 'center' },
  body: { marginTop: spacing.md, fontSize: 15, fontFamily: fonts.regular, color: MM.muted, lineHeight: 22, textAlign: 'center' },
  quoteCard: {
    marginTop: spacing.lg,
    backgroundColor: MM.surfaceWarm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
  },
  quote: { fontSize: 16, fontStyle: 'italic', color: MM.accent, textAlign: 'center', fontFamily: fonts.medium },
  checkRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: MM.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: MM.primary, borderColor: MM.primary },
  checkCopy: { flex: 1, fontSize: 14, lineHeight: 20, color: MM.text, fontFamily: fonts.regular },
  cta: { marginTop: spacing.lg, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  backLink: { marginTop: spacing.md, alignSelf: 'center' },
  backText: { color: MM.muted, fontFamily: fonts.regular },
});
