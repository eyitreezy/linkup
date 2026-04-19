import { colors, radius, spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  avatarUrl: string | null;
  email?: string | null;
  verified: boolean;
  /** Presence / visibility summary for own profile. */
  activityHint?: string | null;
};

export function ProfileUserHeader({ name, avatarUrl, email, verified, activityHint }: Props) {
  return (
    <View style={styles.wrap}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.avatar, styles.ph]}>
          <Text style={styles.phTxt}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.meta}>
        <Text style={styles.name}>{name}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
        <View style={[styles.badge, verified ? styles.badgeOn : styles.badgeOff]}>
          <Ionicons name={verified ? 'checkmark-circle' : 'alert-circle-outline'} size={16} color={verified ? colors.success : colors.textMuted} />
          <Text style={[styles.badgeTxt, verified ? styles.badgeTxtOn : styles.badgeTxtOff]}>
            {verified ? 'Verified' : 'Not verified'}
          </Text>
        </View>
        {activityHint ? <Text style={styles.activity}>{activityHint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.border },
  ph: { alignItems: 'center', justifyContent: 'center' },
  phTxt: { fontSize: 28, fontWeight: '800', color: colors.textMuted },
  meta: { flex: 1 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  badgeOn: { backgroundColor: '#ECFDF5' },
  badgeOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  badgeTxt: { fontSize: 13, fontWeight: '800' },
  badgeTxtOn: { color: colors.success },
  badgeTxtOff: { color: colors.textMuted },
  activity: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },
});
