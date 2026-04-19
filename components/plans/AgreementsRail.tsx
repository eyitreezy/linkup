/**
 * Horizontal “connections” strip — dating-app polish (photo-forward + plan context).
 */
import { Avatar } from '@/components/Avatar';
import { colors, radius, spacing } from '@/constants/theme';
import type { AgreementRailItem } from '@/lib/plans/fetchAgreementsRail';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const CARD_W = 164;

type Props = {
  items: AgreementRailItem[];
  loading?: boolean;
};

export function AgreementsRail({ items, loading }: Props) {
  const showSkeleton = !!loading && items.length === 0;

  if (!showSkeleton && items.length === 0) return null;

  return (
    <View style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollPad}
        decelerationRate="fast"
      >
        {showSkeleton
          ? [0, 1, 2].map((k) => (
              <View key={k} style={[styles.card, styles.skeletonCard]}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonLineWide} />
                <View style={styles.skeletonLineNarrow} />
              </View>
            ))
          : items.map((item) => (
              <Pressable
                key={item.planId}
                onPress={() => router.push(`/plan/${item.planId}/agreement` as Href)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Open agreement with ${item.counterpartName} for ${item.planTitle}`}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.cardAccent}
                />
                <View style={styles.cardInner}>
                  <View style={styles.avatarRing}>
                    <Avatar uri={item.counterpartAvatarUrl} name={item.counterpartName} size={72} />
                  </View>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.counterpartName}
                    </Text>
                    {item.counterpartVerified ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={styles.verifiedIcon} />
                    ) : null}
                  </View>
                  <Text style={styles.roleHint}>{item.role === 'host' ? 'Your guest' : 'Your host'}</Text>
                  <Text style={styles.planTitle} numberOfLines={2}>
                    {item.planTitle}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{item.statusLabel}</Text>
                    </View>
                    {item.whenHint ? (
                      <Text style={styles.whenHint} numberOfLines={1}>
                        {item.whenHint}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
      </ScrollView>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#1A1D26',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 5,
};

const ringShadow = {
  shadowColor: '#6C63FF',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 3,
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  scrollPad: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  card: {
    width: CARD_W,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginRight: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 29, 38, 0.06)',
    ...cardShadow,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  cardAccent: {
    height: 3,
    width: '100%',
  },
  cardInner: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    ...ringShadow,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    gap: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.35,
    flexShrink: 1,
  },
  verifiedIcon: { marginTop: 1 },
  roleHint: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  planTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
    textAlign: 'center',
    minHeight: 36,
    width: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    width: '100%',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  whenHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    flexShrink: 1,
  },
  skeletonCard: {
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 220,
  },
  skeletonAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  skeletonLineWide: {
    height: 14,
    width: '88%',
    borderRadius: 6,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  skeletonLineNarrow: {
    height: 12,
    width: '60%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
});
