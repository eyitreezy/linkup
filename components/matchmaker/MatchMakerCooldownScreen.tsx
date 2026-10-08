import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { daysUntilGate } from '@/lib/matchmaker/gates';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  cooldownUntil?: string;
};

export function MatchMakerCooldownScreen({ cooldownUntil }: Props) {
  const insets = useSafeAreaInsets();
  const daysRemaining = daysUntilGate(cooldownUntil);
  const expired = daysRemaining <= 0;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Ionicons name="time-outline" size={48} color={MM.muted} />
      <Text style={styles.title}>MatchMaker is paused for 30 days.</Text>
      <Text style={styles.body}>
        MatchMaker is built for intentional connections. We want to make sure the pool stays that way.
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.max(0, Math.min(100, ((30 - daysRemaining) / 30) * 100))}%` },
          ]}
        />
      </View>
      <Text style={styles.days}>{daysRemaining} days remaining</Text>
      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          All other LinkUp features are fully available.
        </Text>
      </View>
      <Pressable
        disabled={!expired}
        onPress={() => {
          if (expired) router.replace('/matchmaker/reentry' as Href);
        }}
        style={[styles.cta, !expired && styles.ctaDisabled]}
      >
        <Text style={[styles.ctaText, !expired && styles.ctaTextDisabled]}>
          {expired ? 'Enter MatchMaker' : `MatchMaker resumes in ${daysRemaining} days`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MM.surfaceWarm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: MM.text,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    color: MM.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressTrack: {
    marginTop: spacing.xl,
    width: '100%',
    height: 8,
    borderRadius: radius.full,
    backgroundColor: MM.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: MM.accent },
  days: { marginTop: spacing.sm, fontFamily: fonts.medium, color: MM.muted },
  noteCard: {
    marginTop: spacing.lg,
    backgroundColor: MM.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
    width: '100%',
  },
  noteText: { fontFamily: fonts.regular, color: MM.muted, textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: 'auto',
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: MM.accent,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: MM.surface, borderWidth: 1, borderColor: MM.border },
  ctaText: { color: '#fff', fontFamily: fonts.bold },
  ctaTextDisabled: { color: MM.disabled },
});
