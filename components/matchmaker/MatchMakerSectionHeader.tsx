/**
 * Section title row — edit-profile pattern with MatchMaker color tokens.
 */
import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function MatchMakerSectionHeader({ title, icon }: Props) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadRow}>
        <View style={styles.sectionAccentDot} />
        {icon ? <Ionicons name={icon} size={16} color={MM.accent} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <LinearGradient
        colors={['rgba(108, 99, 255, 0.35)', 'rgba(155, 27, 75, 0.22)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionRule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MM.accent,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: MM.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionRule: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
});
