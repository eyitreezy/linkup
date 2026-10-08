import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { CompatibilitySignalChips } from '@/components/matchmaker/CompatibilitySignalChips';
import { ageFromBirthDate } from '@/lib/matchmaker/compatibility';
import type { MatchMakerInterestItem } from '@/lib/matchmaker/types';
import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { VerificationBadge } from '@/components/trust/VerificationBadge';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  item: MatchMakerInterestItem;
  signals: string[];
  mode: 'sent' | 'received';
  busy?: boolean;
  onPressProfile?: () => void;
  onExpressBack?: () => void;
  onPass?: () => void;
};

export function MatchMakerInterestCard({
  item,
  signals,
  mode,
  busy,
  onPressProfile,
  onExpressBack,
  onPass,
}: Props) {
  const profile = item.profile;
  const age = ageFromBirthDate(profile.birth_date);
  const name = profile.display_name?.trim() || 'Member';
  const topSignal = signals[0];

  return (
    <View style={styles.card}>
      <Pressable onPress={onPressProfile} disabled={!onPressProfile}>
        <Avatar uri={profile.avatar_url} name={name} size={56} />
      </Pressable>
      <View style={styles.body}>
        <Pressable onPress={onPressProfile} disabled={!onPressProfile}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
              {age != null ? `, ${age}` : ''}
            </Text>
            {profile.verified_badge ? <VerificationBadge verified variant="chip" /> : null}
          </View>
          {profile.location_label ? (
            <Text style={styles.location} numberOfLines={1}>
              {profile.location_label}
            </Text>
          ) : null}
        </Pressable>
        {topSignal ? (
          <Text style={styles.signal} numberOfLines={2}>
            {topSignal}
          </Text>
        ) : signals.length > 0 ? (
          <CompatibilitySignalChips signals={signals.slice(0, 1)} />
        ) : null}

        {mode === 'received' ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onPass}
              disabled={busy}
              style={({ pressed }) => [styles.passBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
            >
              <Text style={styles.passText}>Pass</Text>
            </Pressable>
            <Button
              title="Express Interest"
              onPress={() => onExpressBack?.()}
              loading={busy}
              gradient
              pill
              style={styles.interestBtn}
            />
          </View>
        ) : (
          <Text style={styles.pendingLabel}>Interest sent · pending</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: MM.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: MM.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  body: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: MM.text,
    flexShrink: 1,
  },
  location: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: MM.muted,
  },
  signal: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: MM.text,
    lineHeight: 18,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  passBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  passText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: MM.muted,
  },
  interestBtn: { flex: 1, minHeight: 40 },
  pendingLabel: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: MM.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
