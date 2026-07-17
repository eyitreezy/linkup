/**
 * Public member profile shell — matches user/[id] layout without blocking navigation.
 */
import { colors, radius, spacing, fonts } from '@/constants/theme';
import { AppShellBackground } from '@/components/ui/AppShellBackground';
import { Ionicons } from '@expo/vector-icons';
import { goBackOrFallback } from '@/lib/navigation/goBackOrFallback';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function Bone({ style }: { style?: object }) {
  return <View style={[styles.bone, style]} />;
}

export function PublicUserProfileSkeleton() {
  return (
    <View style={styles.shell}>
      <AppShellBackground />

      <View style={styles.topNavOverlay}>
        <Pressable
          onPress={() => goBackOrFallback()}
          style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={styles.scrollView}
      >
        <Bone style={styles.galleryBone} />
        <View style={styles.scrollBody}>
        <View style={styles.leadBlock}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.leadAccent}
          />
          <View style={styles.leadCol}>
            <Bone style={styles.kickerBone} />
            <Bone style={styles.titleBone} />
            <Bone style={styles.subBone} />
          </View>
        </View>

        <View style={styles.profileCard}>
          <Bone style={styles.avatarBone} />
          <Bone style={styles.nameBone} />
          <Bone style={styles.presenceBone} />
        </View>

        <View style={styles.sectionCard}>
          <Bone style={styles.sectionTitleBone} />
          <Bone style={styles.lineBone} />
          <Bone style={styles.lineBoneShort} />
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, position: 'relative' },
  topNavOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: { opacity: 0.92 },
  galleryBone: {
    width: '100%',
    aspectRatio: 1 / 1.12,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
  },
  scrollView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xl * 2,
  },
  scrollBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  bone: {
    borderRadius: 8,
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
  },
  leadBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  leadAccent: {
    width: 5,
    marginTop: 8,
    borderRadius: 3,
    height: 52,
  },
  leadCol: { flex: 1, gap: 8 },
  kickerBone: { width: 64, height: 11 },
  titleBone: { width: '68%', height: 28 },
  subBone: { width: '92%', height: 14 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    gap: spacing.sm,
  },
  avatarBone: { width: 104, height: 104, borderRadius: 52 },
  nameBone: { width: 140, height: 22 },
  presenceBone: { width: 100, height: 14 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    gap: spacing.sm,
  },
  sectionTitleBone: { width: '42%', height: 16 },
  lineBone: { width: '100%', height: 13 },
  lineBoneShort: { width: '72%', height: 13 },
});
