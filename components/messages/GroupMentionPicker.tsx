import { Avatar } from '@/components/Avatar';
import { colors, fonts, spacing } from '@/constants/theme';
import type { GroupMentionMember } from '@/lib/messaging/groupMentions';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  members: GroupMentionMember[];
  avatarByUserId?: Map<string, string | null>;
  onSelect: (member: GroupMentionMember) => void;
  visible: boolean;
};

export function GroupMentionPicker({ members, avatarByUserId, onSelect, visible }: Props) {
  if (!visible || members.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Mention someone</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Mention ${item.displayName}`}
          >
            <Avatar uri={avatarByUserId?.get(item.userId) ?? null} name={item.displayName} size={36} />
            <Text style={styles.name} numberOfLines={1}>
              {item.displayName}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    maxHeight: 196,
  },
  title: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  list: {
    maxHeight: 160,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  rowPressed: {
    backgroundColor: 'rgba(94, 82, 255, 0.08)',
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
  },
});
