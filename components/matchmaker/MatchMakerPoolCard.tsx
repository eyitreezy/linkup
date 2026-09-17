import { Avatar } from '@/components/Avatar';
import { CompatibilitySignalChips } from '@/components/matchmaker/CompatibilitySignalChips';
import { ageFromBirthDate } from '@/lib/matchmaker/compatibility';
import type { MatchMakerPoolProfile } from '@/lib/matchmaker/types';
import { MM, fonts, radius, spacing } from '@/constants/matchmakerTheme';
import { VerificationBadge } from '@/components/trust/VerificationBadge';
import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  profile: MatchMakerPoolProfile;
  signals: string[];
  onPressProfile?: () => void;
};

export function MatchMakerPoolCard({ profile, signals, onPressProfile }: Props) {
  const age = ageFromBirthDate(profile.birth_date);
  const photo = profile.avatar_url;

  return (
    <View style={styles.card}>
      {photo ? (
        <ImageBackground source={{ uri: photo }} style={styles.photo} imageStyle={styles.photoRadius}>
          <View style={styles.photoOverlay} />
        </ImageBackground>
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Avatar uri={null} name={profile.display_name ?? 'Member'} size={72} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.display_name ?? 'Member'}
            {age != null ? `, ${age}` : ''}
          </Text>
          {profile.verified_badge ? <VerificationBadge verified variant="chip" /> : null}
        </View>
        {profile.location_label ? (
          <Text style={styles.location} numberOfLines={1}>
            {profile.location_label}
          </Text>
        ) : null}
        <CompatibilitySignalChips signals={signals} />
        {profile.interests?.length ? (
          <Text style={styles.interests} numberOfLines={1}>
            {profile.interests.slice(0, 4).join(' · ')}
          </Text>
        ) : null}
        {onPressProfile ? (
          <Pressable onPress={onPressProfile} style={styles.viewProfile}>
            <Text style={styles.viewProfileText}>View full profile</Text>
            <Ionicons name="chevron-forward" size={14} color={MM.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: MM.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MM.border,
    shadowColor: MM.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  photo: { height: '55%', minHeight: 220, backgroundColor: MM.surfaceWarm },
  photoRadius: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  photoOverlay: { flex: 1, backgroundColor: 'rgba(26, 29, 38, 0.04)' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: spacing.md, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 20, fontFamily: fonts.bold, fontWeight: '800', color: MM.text },
  location: { fontSize: 13, fontFamily: fonts.regular, color: MM.muted },
  interests: { fontSize: 12, fontFamily: fonts.regular, color: MM.muted, marginTop: 4 },
  viewProfile: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
  },
  viewProfileText: { fontSize: 13, fontFamily: fonts.medium, color: MM.primary, fontWeight: '700' },
});
