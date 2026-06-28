/**
 * Chat thread loading placeholders — mimics left/right bubbles above the composer.
 */
import { colors, spacing } from '@/constants/theme';
import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';

type BubbleProps = {
  align: 'left' | 'right';
  width: `${number}%` | number;
  height: number;
  delay: number;
};

function BubbleSkeleton({ align, width, height, delay }: BubbleProps) {
  const rowStyle = align === 'right' ? styles.rowRight : styles.rowLeft;
  const bubbleStyle = align === 'right' ? styles.bubbleMine : styles.bubbleTheirs;

  return (
    <View style={rowStyle}>
      <MotiView
        from={{ opacity: 0.35 }}
        animate={{ opacity: 0.9 }}
        transition={{ loop: true, type: 'timing', duration: 900, delay }}
        style={[bubbleStyle, { width, height }]}
      />
    </View>
  );
}

export function ChatThreadSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading messages">
      <BubbleSkeleton align="left" width="46%" height={44} delay={0} />
      <BubbleSkeleton align="right" width="52%" height={56} delay={80} />
      <BubbleSkeleton align="left" width="58%" height={72} delay={160} />
      <BubbleSkeleton align="right" width="44%" height={44} delay={240} />
      <BubbleSkeleton align="left" width="38%" height={44} delay={320} />
      <BubbleSkeleton align="right" width="62%" height={64} delay={400} />
      <BubbleSkeleton align="left" width="50%" height={48} delay={480} />
      <BubbleSkeleton align="right" width="36%" height={44} delay={560} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  bubbleTheirs: {
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.1)',
  },
  bubbleMine: {
    borderRadius: 18,
    borderBottomRightRadius: 6,
    backgroundColor: 'rgba(94, 82, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 74, 114, 0.14)',
  },
});
