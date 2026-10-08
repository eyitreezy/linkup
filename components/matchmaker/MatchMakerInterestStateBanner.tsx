import {
  interestRelationLabel,
  type MatchMakerInterestRelationState,
} from '@/lib/matchmaker/interestRelation';
import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  state: MatchMakerInterestRelationState;
};

export function MatchMakerInterestStateBanner({ state }: Props) {
  const label = interestRelationLabel(state);
  if (!label) return null;

  const icon: keyof typeof Ionicons.glyphMap =
    state === 'interest_sent'
      ? 'heart'
      : state === 'passed'
        ? 'close-circle-outline'
        : state === 'matched'
          ? 'checkmark-circle'
          : 'information-circle-outline';

  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={18} color={MM.accent} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MM.surfaceWarm,
    borderWidth: 1,
    borderColor: MM.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: MM.text,
  },
});
