/**
 * Compact saved-plan row — dense list layout with a color accent stripe.
 */
import { Avatar } from '@/components/Avatar';
import { colors, radius, spacing } from '@/constants/theme';
import type { SavedPlanListItem } from '@/lib/plans/fetchSavedPlans';
import { formatPlanPrice, formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  item: SavedPlanListItem;
  onPressCard: () => void;
  onUnsave: () => void;
};

export function SavedPlanCard({ item, onPressCard, onUnsave }: Props) {
  const { plan, creator } = item;
  const name = creator.display_name?.trim() || 'Host';
  const when = formatPlanWhen(plan);
  const price = formatPlanPrice(plan);
  const loc = plan.location_label?.trim() ?? 'Location TBC';

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.passAction, colors.primary, '#FACC15', colors.success]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.accentStripe}
      />
      <View style={styles.cardBody}>
        <Pressable
          onPress={onPressCard}
          style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${plan.title}, hosted by ${name}`}
        >
          <View style={styles.body}>
            <Avatar uri={creator.avatar_url} name={name} size={52} />
            <View style={styles.textCol}>
              <Text style={styles.title} numberOfLines={2}>
                {plan.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta} numberOfLines={1}>
                  {name}
                </Text>
                {creator.verified_badge ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={styles.verified} />
                ) : null}
              </View>
              <Text style={styles.detail} numberOfLines={1}>
                {loc}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {when}
              </Text>
              {price ? (
                <Text style={styles.price} numberOfLines={1}>
                  {price}
                </Text>
              ) : (
                <Text style={styles.priceMuted}>Open price</Text>
              )}
            </View>
          </View>
        </Pressable>
        <Pressable
          onPress={onUnsave}
          hitSlop={12}
          style={({ pressed }) => [styles.bookmarkBtn, pressed && styles.bookmarkPressed]}
          accessibilityRole="button"
          accessibilityLabel="Remove from saved"
        >
          <LinearGradient
            colors={['rgba(108, 99, 255, 0.14)', 'rgba(255, 101, 132, 0.12)']}
            style={styles.bookmarkBg}
          >
            <Ionicons name="bookmark" size={22} color={colors.primary} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#1A1D26',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  accentStripe: {
    width: 5,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    backgroundColor: colors.surface,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  cardMain: { padding: spacing.md, paddingRight: 52 },
  cardPressed: { opacity: 0.96 },
  bookmarkBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  bookmarkBg: {
    padding: 8,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  bookmarkPressed: { opacity: 0.65 },
  body: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  meta: { fontSize: 14, fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  verified: { marginTop: 1 },
  detail: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontWeight: '500' },
  price: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: 8 },
  priceMuted: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 8 },
});
