/**
 * Skeletal placeholders for the Wallet tab — matches Offers / Messages pattern.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

function ActivityRowSkeleton() {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowStripe} />
      <View style={styles.rowBody}>
        <View style={styles.rowLeft}>
          <View style={styles.rowTypeRow}>
            <View style={styles.typeBone} />
            <View style={styles.pillBone} />
          </View>
          <View style={styles.dateBone} />
        </View>
        <View style={styles.amtBone} />
      </View>
    </View>
  );
}

export function WalletSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.balanceShell}>
        <View style={styles.balanceInner}>
          <View style={styles.balanceTop}>
            <View style={styles.labelBone} />
            <View style={styles.liveBone} />
          </View>
          <View style={styles.amtBoneLg} />
          <View style={styles.hintBone} />
          <View style={styles.hintBoneShort} />
          <View style={styles.footerBone} />
        </View>
      </View>

      <View style={styles.goodwillCard}>
        <View style={styles.goodwillHeader}>
          <View style={styles.iconBone} />
          <View style={styles.goodwillTitleBone} />
        </View>
        <View style={styles.goodwillAmtBone} />
        <View style={styles.goodwillHintBone} />
        <View style={styles.goodwillHintBoneShort} />
      </View>

      <View style={styles.withdrawCard}>
        <View style={styles.withdrawIcon} />
        <View style={styles.withdrawTextCol}>
          <View style={styles.withdrawTitleBone} />
          <View style={styles.withdrawHintBone} />
          <View style={styles.withdrawHintBoneShort} />
        </View>
      </View>

      <View style={styles.sectionHead}>
        <View style={styles.sectionIconBone} />
        <View style={styles.sectionBone} />
      </View>

      {[0, 1, 2, 3].map((k) => (
        <ActivityRowSkeleton key={k} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.xs },
  balanceShell: {
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
  },
  balanceInner: {
    borderRadius: radius.xl - 2,
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  labelBone: {
    width: 120,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
  },
  liveBone: {
    width: 52,
    height: 22,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255, 101, 132, 0.12)',
  },
  amtBoneLg: {
    width: '62%',
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.16)',
    marginTop: 4,
  },
  hintBone: {
    width: '92%',
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    marginTop: spacing.md,
  },
  hintBoneShort: {
    width: '72%',
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.08)',
    marginTop: 8,
  },
  footerBone: {
    width: '55%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    marginTop: spacing.lg,
  },
  goodwillCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255, 249, 230, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  goodwillHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  goodwillTitleBone: {
    width: 140,
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  goodwillAmtBone: {
    width: '45%',
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    marginTop: spacing.sm,
  },
  goodwillHintBone: {
    width: '96%',
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    marginTop: spacing.sm,
  },
  goodwillHintBoneShort: {
    width: '78%',
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.08)',
    marginTop: 8,
  },
  withdrawCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  withdrawIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  withdrawTextCol: { flex: 1, gap: 8 },
  withdrawTitleBone: {
    width: 110,
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
  },
  withdrawHintBone: {
    width: '100%',
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
  },
  withdrawHintBoneShort: {
    width: '82%',
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.08)',
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  sectionIconBone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 101, 132, 0.15)',
  },
  sectionBone: {
    width: 120,
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  rowCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  rowStripe: {
    width: 4,
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowLeft: { flex: 1, paddingRight: 12, gap: 8 },
  rowTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBone: {
    width: 52,
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
  },
  pillBone: {
    width: 72,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  dateBone: {
    width: '68%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.08)',
  },
  amtBone: {
    width: 72,
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
});
