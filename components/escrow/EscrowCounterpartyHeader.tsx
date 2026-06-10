import { Avatar } from '@/components/Avatar';
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export type EscrowParty = {
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

const AVATAR_INNER = 56;
const RING = 3;

function AvatarGradientRing({ children }: { children: ReactNode }) {
  const outer = AVATAR_INNER + RING * 2;
  return (
    <LinearGradient
      colors={[...APP_CHIP_GRADIENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatarRing, { width: outer, height: outer, borderRadius: outer / 2 }]}
    >
      <View style={styles.avatarInner}>{children}</View>
    </LinearGradient>
  );
}

type Props = { title: string; counterparty: EscrowParty; youLabel: string };

export function EscrowCounterpartyHeader({ title, counterparty, youLabel }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(108,99,255,0.14)', 'rgba(255,101,132,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlow}
      />

      <Text style={styles.kicker}>Plan</Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      <LinearGradient
        colors={['rgba(108,99,255,0.35)', 'rgba(255,101,132,0.2)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.rule}
      />

      <View style={styles.row}>
        <View style={styles.avatarSlot}>
          <AvatarGradientRing>
            <Avatar uri={counterparty.avatarUrl} name={counterparty.name} size={AVATAR_INNER} />
          </AvatarGradientRing>
          {counterparty.verified ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            </View>
          ) : null}
        </View>

        <View style={styles.meta}>
          <Text style={styles.cpLabel}>With</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{counterparty.name}</Text>
            {counterparty.verified ? (
              <View style={styles.verifiedPill}>
                <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                <Text style={styles.verifiedPillTxt}>Verified</Text>
              </View>
            ) : null}
          </View>
          {youLabel ? (
            <View style={styles.youRow}>
              <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.you}>{youLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#2a1f55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
    overflow: 'hidden',
    ...cardShadow,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  rule: { height: 3, borderRadius: 2, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarSlot: { position: 'relative' },
  avatarRing: {
    padding: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: AVATAR_INNER,
    height: AVATAR_INNER,
    borderRadius: AVATAR_INNER / 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    padding: 1,
  },
  meta: { flex: 1, minWidth: 0 },
  cpLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  name: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  verifiedPillTxt: { fontSize: 11, fontWeight: '800', color: '#047857' },
  youRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 99, 255, 0.12)',
  },
  you: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18, fontWeight: '600' },
});
