import { MM, MM_CTA_GRADIENT, MM_CTA_GRADIENT_LOCATIONS, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type ReactNode } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  icon?: ReactNode;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onBack?: () => void;
};

export function MatchMakerGateScreen({
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={MM.text} />
        </Pressable>
      ) : null}
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          {icon ?? <MatchMakerRingIcon />}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable onPress={onPrimary} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
          <LinearGradient
            colors={[...MM_CTA_GRADIENT]}
            locations={[...MM_CTA_GRADIENT_LOCATIONS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryLabel}>{primaryLabel}</Text>
          </LinearGradient>
        </Pressable>
        {secondaryLabel && onSecondary ? (
          <Pressable onPress={onSecondary} style={styles.secondaryBtn}>
            <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MatchMakerRingIcon() {
  return <Ionicons name="heart-circle" size={48} color={MM.accent} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MM.bg, paddingHorizontal: spacing.lg },
  back: { alignSelf: 'flex-start', padding: 4, marginBottom: spacing.md },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconWrap: { marginBottom: spacing.lg },
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
    fontWeight: '800',
    color: MM.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: MM.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    minWidth: 260,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryLabel: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.bold, fontWeight: '800' },
  secondaryBtn: { marginTop: spacing.md, padding: spacing.sm },
  secondaryLabel: { color: MM.muted, fontSize: 14, fontFamily: fonts.medium },
});
