import { colors, radius, spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type EscrowParty = {
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

type Props = { title: string; counterparty: EscrowParty; youLabel: string };

export function EscrowCounterpartyHeader({ title, counterparty, youLabel }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.row}>
        {counterparty.avatarUrl ? (
          <Image source={{ uri: counterparty.avatarUrl }} style={styles.avatar} contentFit="cover" transition={120} />
        ) : (
          <View style={[styles.avatar, styles.avatarPh]}>
            <Ionicons name="person" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.cpLabel}>With</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{counterparty.name}</Text>
            {counterparty.verified ? (
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.badgeTxt}>Verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.you}>{youLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: spacing.md, lineHeight: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radius.button, backgroundColor: colors.border },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1 },
  cpLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeTxt: { fontSize: 13, fontWeight: '700', color: colors.success },
  you: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
