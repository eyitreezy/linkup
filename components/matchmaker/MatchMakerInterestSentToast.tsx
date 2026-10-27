import { MM, fonts, spacing } from '@/constants/matchmakerTheme';
import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

type Props = {
  visible: boolean;
  onHidden: () => void;
};

const DISMISS_MS = 2000;

export function MatchMakerInterestSentToast({ visible, onHidden }: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHidden, DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible, onHidden]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      style={styles.wrap}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.toast}>
        <MatchMakerTabIcon size={18} color={MM.accent} active />
        <Text style={styles.text}>Interest sent</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 100,
    alignItems: 'center',
    zIndex: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MM.surfaceWarm,
    borderWidth: 1,
    borderColor: MM.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    shadowColor: '#1A1D26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  text: { fontSize: 14, fontFamily: fonts.bold, color: MM.text },
});
