/**
 * Full-screen profile photo preview — edit profile / onboarding galleries.
 */
import { fonts, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
};

export function ProfilePhotoPreviewModal({ visible, uris, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setIndex(Math.min(Math.max(initialIndex, 0), Math.max(0, uris.length - 1)));
  }, [visible, initialIndex, uris.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? uris.length - 1 : i - 1));
  }, [uris.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= uris.length - 1 ? 0 : i + 1));
  }, [uris.length]);

  if (!visible || uris.length === 0) return null;

  const uri = uris[index];
  const showNav = uris.length > 1;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.shell}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close preview" />

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          {showNav ? (
            <Text style={styles.counter}>
              {index + 1} / {uris.length}
            </Text>
          ) : (
            <View style={styles.counterSpacer} />
          )}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.stage, { width, height: height * 0.72 }]}>
          <Image source={{ uri }} style={styles.image} contentFit="contain" transition={120} cachePolicy="memory-disk" />

          {showNav ? (
            <>
              <Pressable
                onPress={goPrev}
                style={({ pressed }) => [styles.navBtn, styles.navLeft, pressed && styles.navPressed]}
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
              >
                <Ionicons name="chevron-back" size={26} color="#fff" />
              </Pressable>
              <Pressable
                onPress={goNext}
                style={({ pressed }) => [styles.navBtn, styles.navRight, pressed && styles.navPressed]}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
              >
                <Ionicons name="chevron-forward" size={26} color="#fff" />
              </Pressable>
            </>
          ) : null}
        </View>

        <Text style={[styles.hint, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          Double-tap a thumbnail to preview · tap outside to close
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 18, 0.94)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    zIndex: 2,
  },
  counter: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.88)',
  },
  counterSpacer: { flex: 1 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  stage: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  navLeft: { left: spacing.sm },
  navRight: { right: spacing.sm },
  navPressed: { opacity: 0.86, transform: [{ scale: 0.96 }] },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.55)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...Platform.select({ web: { userSelect: 'none' as const }, default: {} }),
  },
});
