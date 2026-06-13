import { Avatar } from '@/components/Avatar';
import { colors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import { Image } from 'react-native';

type MemberPreview = { avatarUrl: string | null; name: string };

type Props = {
  avatarUrl?: string | null;
  groupName: string;
  size: number;
  memberPreviews?: MemberPreview[];
};

export function GroupAvatar({ avatarUrl, groupName, size, memberPreviews = [] }: Props) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  const previews = memberPreviews.slice(0, 4);
  if (previews.length <= 1) {
    return <Avatar uri={null} name={groupName} size={size} />;
  }

  const half = size / 2 - 1;
  return (
    <View style={[styles.grid, { width: size, height: size, borderRadius: size / 2 }]}>
      {previews.map((m, i) => (
        <View key={`${m.name}-${i}`} style={{ width: half, height: half, overflow: 'hidden' }}>
          <Avatar uri={m.avatarUrl} name={m.name} size={half} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    backgroundColor: colors.border,
    alignContent: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
