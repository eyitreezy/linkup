/**
 * Inbox-grade detail sheet — scrollable body + gradient CTA (admin/support, etc.).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  onClose: () => void;
  kicker?: string;
  title: string;
  icon?: IonName;
  iconGrad?: readonly [string, string];
  primaryLabel?: string;
  dismissOnBackdrop?: boolean;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function AppDetailModal({
  visible,
  onClose,
  kicker = 'LinkUp',
  title,
  icon = 'document-text-outline',
  iconGrad = [colors.primary, colors.secondary],
  primaryLabel = 'Close',
  dismissOnBackdrop = true,
  children,
  contentContainerStyle,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  /** Room for icon, title, CTA, and padding — body scroll gets the rest. */
  const scrollMaxHeight = Math.max(140, Math.min(windowHeight * 0.86, 560) - 220);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={dismissOnBackdrop ? onClose : undefined}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Pressable style={styles.sheetHit} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.45)', 'rgba(255,101,132,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ring}
          >
            <View style={styles.card}>
              <LinearGradient
                colors={[...iconGrad]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGrad}
              >
                <Ionicons name={icon} size={28} color="#fff" />
              </LinearGradient>

              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title}>{title}</Text>

              <ScrollView
                style={[styles.bodyScroll, { maxHeight: scrollMaxHeight }]}
                contentContainerStyle={[styles.bodyContent, contentContainerStyle]}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                bounces
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.ctaOuter, pressed && styles.ctaPressed]}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGrad}
                >
                  <Text style={styles.ctaTxt}>{primaryLabel}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 29, 38, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  sheetHit: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    maxHeight: '92%',
  },
  ring: {
    borderRadius: radius.xl + 2,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    maxHeight: '100%',
    flexShrink: 1,
    overflow: 'hidden',
  },
  iconGrad: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  bodyScroll: {
    alignSelf: 'stretch',
    flexShrink: 1,
    marginBottom: spacing.md,
  },
  bodyContent: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  ctaOuter: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  ctaGrad: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  ctaTxt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
