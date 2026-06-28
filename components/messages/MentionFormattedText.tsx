import { colors, fonts } from '@/constants/theme';
import { parseGroupMentionSegments, type MentionSegment } from '@/lib/messaging/groupMentions';
import { useMemo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

type Props = {
  body: string;
  nameByUserId: Map<string, string>;
  baseStyle: TextStyle;
  mentionStyleMine?: TextStyle;
  mentionStyleThem?: TextStyle;
  isMine: boolean;
};

export function MentionFormattedText({
  body,
  nameByUserId,
  baseStyle,
  mentionStyleMine,
  mentionStyleThem,
  isMine,
}: Props) {
  const segments = useMemo(
    () => parseGroupMentionSegments(body, nameByUserId),
    [body, nameByUserId]
  );

  if (segments.length === 1 && segments[0]?.type === 'text') {
    return <Text style={baseStyle}>{body}</Text>;
  }

  const mentionStyle = isMine
    ? [styles.mentionMine, mentionStyleMine]
    : [styles.mentionThem, mentionStyleThem];

  return (
    <Text style={baseStyle}>
      {segments.map((segment, index) => (
        <SegmentText key={`${segment.type}-${index}`} segment={segment} mentionStyle={mentionStyle} />
      ))}
    </Text>
  );
}

function SegmentText({
  segment,
  mentionStyle,
}: {
  segment: MentionSegment;
  mentionStyle: TextStyle[];
}) {
  if (segment.type === 'mention') {
    return <Text style={mentionStyle}>{segment.label}</Text>;
  }
  return <Text>{segment.value}</Text>;
}

const styles = StyleSheet.create({
  mentionMine: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: fonts.bold,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 4,
  },
  mentionThem: {
    color: colors.primary,
    fontWeight: '800',
    fontFamily: fonts.bold,
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
    borderRadius: 4,
  },
});
