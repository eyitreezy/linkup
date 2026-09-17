import { MM, MM_CTA_GRADIENT, fonts, spacing } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerReentryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + spacing.lg }]}>
      <Ionicons name="heart-circle" size={48} color={MM.accent} />
      <Text style={styles.title}>Ready when you are.</Text>
      <Text style={styles.body}>
        We have updated your MatchMaker profile based on what you shared. Your pool is waiting.
      </Text>
      <Pressable onPress={() => router.replace('/matchmaker' as Href)} style={{ marginTop: spacing.xl, width: '100%', paddingHorizontal: spacing.lg }}>
        <LinearGradient colors={[...MM_CTA_GRADIENT]} style={styles.cta}>
          <Text style={styles.ctaText}>Enter MatchMaker</Text>
        </LinearGradient>
      </Pressable>
      <Text style={styles.note}>There is no rush. This will be here whenever you feel ready.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg, alignItems: 'center', paddingHorizontal: spacing.lg },
  title: { marginTop: spacing.lg, fontSize: 24, fontFamily: fonts.bold, color: MM.text, textAlign: 'center' },
  body: { marginTop: spacing.sm, fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', lineHeight: 22 },
  cta: { borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  note: { marginTop: spacing.md, fontSize: 12, fontFamily: fonts.regular, color: MM.muted, textAlign: 'center' },
});
