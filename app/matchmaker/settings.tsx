import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchMakerSettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: MM.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={MM.text} />
        </Pressable>
        <Text style={styles.title}>MatchMaker Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.section}>My Values</Text>
      {['Communication style', 'Faith preference', 'Family goals', 'Pace preference'].map((label) => (
        <Pressable key={label} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      ))}
      <Text style={[styles.section, { marginTop: spacing.lg }]}>Account</Text>
      <Pressable style={styles.row} onPress={() => router.push('/matchmaker/history' as Href)}>
        <Text style={styles.rowLabel}>Connection history</Text>
        <Ionicons name="chevron-forward" size={16} color={MM.muted} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { fontSize: 18, fontFamily: fonts.bold, color: MM.text },
  section: { fontSize: 13, fontFamily: fonts.bold, color: MM.muted, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MM.border,
  },
  rowLabel: { fontFamily: fonts.medium, color: MM.text },
  edit: { fontFamily: fonts.medium, color: MM.primary },
});
