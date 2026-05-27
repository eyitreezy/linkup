/**
 * PL6a — dual avatars + names + verification (trust header).
 */
import { Avatar } from '@/components/Avatar';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type AgreementParty = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

const AVATAR_INNER = 62;
const RING = 3;

function AvatarRing({
  colorsTuple,
  children,
}: {
  colorsTuple: [string, string];
  children: ReactNode;
}) {
  const outer = AVATAR_INNER + RING * 2;
  return (
    <LinearGradient
      colors={colorsTuple}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        padding: RING,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: AVATAR_INNER,
          height: AVATAR_INNER,
          borderRadius: AVATAR_INNER / 2,
          overflow: 'hidden',
          backgroundColor: colors.surface,
        }}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

type Props = {
  host: AgreementParty;
  guest: AgreementParty;
};

export function PlanAgreementUserHeader({ host, guest }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.avatars}>
        <View style={[styles.avatarSlot, styles.avatarLeft]}>
          <AvatarRing colorsTuple={[colors.primary, colors.secondary]}>
            <Avatar uri={host.avatarUrl} name={host.name} size={AVATAR_INNER} />
          </AvatarRing>
          {host.verified ? (
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            </View>
          ) : null}
        </View>
        <View style={[styles.avatarSlot, styles.avatarRight]}>
          <AvatarRing colorsTuple={[colors.secondary, colors.success]}>
            <Avatar uri={guest.avatarUrl} name={guest.name} size={AVATAR_INNER} />
          </AvatarRing>
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
  wrap: { alignItems: 'center', marginBottom: 0 },
  avatars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarSlot: { position: 'relative' },
  avatarLeft: { marginRight: -16, zIndex: 1 },
  avatarRight: { zIndex: 0 },
  badge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
  },
  names: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', paddingHorizontal: spacing.md },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  and: { fontSize: 16, color: colors.textMuted, fontWeight: '700' },
  caption: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
