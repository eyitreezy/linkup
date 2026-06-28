import { colors, spacing, fonts } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  content: string;
};

/** Plain-text policy body — paragraphs split on blank lines. */
export function PrivacyPolicyBody({ content }: Props) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <View style={styles.wrap}>
      {paragraphs.map((paragraph, index) => (
        <Text key={`p-${index}`} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
    fontFamily: fonts.regular,
    color: colors.text,
  },
});
