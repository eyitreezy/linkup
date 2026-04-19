/**
 * PL6a — dual avatars + names + verification (trust header).
 */
import { Avatar } from '@/components/Avatar';
import { colors, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type AgreementParty = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

type Props = {
  host: AgreementParty;
  guest: AgreementParty;
};

export function PlanAgreementUserHeader({ host, guest }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.avatars}>
        <View style={[styles.avatarSlot, styles.avatarLeft]}>
          <Avatar uri={host.avatarUrl} name={host.name} size={64} />
          {host.verified ? (
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            </View>
          ) : null}
        </View>
        <View style={[styles.avatarSlot, styles.avatarRight]}>
          <Avatar uri={guest.avatarUrl} name={guest.name} size={64} />
          {guest.verified ? (
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.names}>
        <Text style={styles.name} numberOfLines={1}>
          {host.name}
        </Text>
        <Text style={styles.and}>·</Text>
        <Text style={styles.name} numberOfLines={1}>
          {guest.name}
        </Text>
      </View>
      <Text style={styles.caption}>Host and guest for this plan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.lg },
  avatars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarSlot: { position: 'relative' },
  avatarLeft: { marginRight: -12, zIndex: 1 },
  avatarRight: { zIndex: 0 },
  badge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  names: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', paddingHorizontal: spacing.md },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  and: { fontSize: 16, color: colors.textMuted, fontWeight: '700' },
  caption: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
