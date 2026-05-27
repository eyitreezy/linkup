import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Ion = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: Ion;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  /** Unread count badge (e.g. notification inbox). */
  badgeCount?: number;
  /** Omit bottom divider (last row in a card). */
  isLast?: boolean;
};

export function ProfileSettingsRow({ icon, label, subtitle, onPress, danger, badgeCount, isLast }: Props) {
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, isLast && styles.rowLast]}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, danger && styles.iconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.textCol}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
          {showBadge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 29, 38, 0.08)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDanger: { backgroundColor: '#FEF2F2' },
  textCol: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  labelDanger: { color: colors.danger },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
