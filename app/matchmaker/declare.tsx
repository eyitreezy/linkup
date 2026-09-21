import { Button } from '@/components/Button';
import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { colors, fonts as themeFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <MatchMakerTabIcon size={56} color={MM.accent} active style={{ alignSelf: 'center' }} />
      <Text style={styles.title}>Before you enter MatchMaker</Text>
      <Text style={styles.body}>
        MatchMaker is built for one purpose: to help serious-minded individuals find a long-term
        relationship with the potential for marriage.
      </Text>
      <Text style={styles.body}>
        It is not a casual dating feature, a friendship finder, or an exploratory social tool.
      </Text>
      <View style={styles.quoteCard}>
        <Text style={styles.quote}>One person. One connection. One intention.</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.checkCopy}>
          I am entering MatchMaker with the sincere intention of finding a long-term relationship
          with the potential for marriage. I understand that this feature is designed for
          serious-minded individuals and that my behaviour within MatchMaker will be held to that
          standard.
        </Text>
        <Switch
          value={checked}
          onValueChange={setChecked}
          trackColor={{ false: '#E8E4F5', true: colors.primary }}
        />
      </View>
      <Button
        title="I confirm this declaration"
        onPress={() => void onConfirm()}
        loading={busy}
        disabled={!checked}
        gradient
        pill
        fullWidth
        style={{ marginTop: spacing.lg }}
      />
      <Button
        title="Go back"
        onPress={() => router.back()}
        variant="ghost"
        fullWidth
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg },
  title: {
    marginTop: spacing.lg,
    fontSize: 24,
    fontFamily: fonts.bold,
    color: MM.text,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.md,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: MM.muted,
    lineHeight: 22,
    textAlign: 'center',
  },
  quoteCard: {
    marginTop: spacing.lg,
    backgroundColor: MM.surfaceWarm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
  },
  quote: {
    fontSize: 16,
    fontStyle: 'italic',
    color: MM.accent,
    textAlign: 'center',
    fontFamily: fonts.medium,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  checkCopy: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: MM.text,
    fontFamily: themeFonts.regular,
  },
});
