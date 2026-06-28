/**
 * Shared skeletal loader for Confirm plan + Secure payment screens.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

function Bone({ style }: { style?: ViewStyle }) {
  return <View style={[styles.bone, style]} />;
}

export function PlanFlowScreenSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.leadBlock}>
        <View style={styles.leadAccent} />
        <View style={styles.leadCol}>
          <Bone style={styles.kickerBone} />
          <Bone style={styles.titleBone} />
          <Bone style={styles.subBone} />
          <Bone style={styles.subBoneShort} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.dualAvatarRow}>
          <View style={styles.avatarBone} />
          <View style={styles.avatarBone} />
        </View>
        <Bone style={styles.cardLineBone} />
      </View>

      <View style={styles.pillRow}>
        <Bone style={styles.pillBone} />
      </View>

      <View style={styles.card}>
        <Bone style={styles.cardTitleBone} />
        <Bone style={styles.cardLineBone} />
        <Bone style={styles.cardLineBone} />
        <Bone style={styles.cardLineBoneShort} />
      </View>

      <View style={styles.card}>
        <Bone style={styles.cardTitleBone} />
        <Bone style={styles.cardLineBoneShort} />
        <Bone style={styles.cardLineBone} />
      </View>

      <Bone style={styles.ctaBone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: spacing.xl },
  bone: {
    borderRadius: 6,
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
    backgroundColor: 'rgba(94, 82, 255, 0.2)',
  },
  leadCol: { flex: 1, gap: 8 },
  kickerBone: { width: 72, height: 11 },
  titleBone: { width: '72%', height: 28 },
  subBone: { width: '100%', height: 14 },
  subBoneShort: { width: '84%', height: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#2a1f55',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  dualAvatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  avatarBone: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
  },
  pillRow: { alignItems: 'center', marginBottom: spacing.md },
  pillBone: {
    width: 160,
    height: 36,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255, 74, 114, 0.12)',
  },
  cardTitleBone: { width: '48%', height: 16 },
  cardLineBone: { width: '100%', height: 13 },
  cardLineBoneShort: { width: '62%', height: 13 },
  ctaBone: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: 'rgba(94, 82, 255, 0.16)',
    marginTop: spacing.sm,
  },
});
