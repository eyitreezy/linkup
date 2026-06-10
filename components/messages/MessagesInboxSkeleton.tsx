/**
 * Skeletal placeholders for the Messages tab — matches Offers screen pattern.
 */
import { colors, radius, spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

const AVATAR = 58;
const STRIP_AVATAR = 56;

export function MessagesActiveStripSkeleton() {
  return (
    <View style={styles.stripSection}>
      <View style={styles.stripGlass}>
        <View style={styles.stripTitleBone} />
        <View style={styles.stripRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.stripCell}>
              <View style={styles.stripRing} />
              <View style={styles.stripNameBone} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ConversationCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.avatar} />
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <View style={styles.nameBone} />
            <View style={styles.timeBone} />
          </View>
          <View style={styles.previewBone} />
          <View style={styles.previewBoneShort} />
        </View>
      </View>
    </View>
  );
}

export function MessagesInboxSkeleton({ includeStrip = true }: { includeStrip?: boolean }) {
  return (
    <View style={styles.wrap}>
      {includeStrip ? <MessagesActiveStripSkeleton /> : null}
      <View style={styles.recentBone} />
      {[0, 1, 2, 3].map((k) => (
        <ConversationCardSkeleton key={k} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.xs },
  stripSection: { paddingBottom: spacing.xs },
  stripGlass: {
    marginHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(237, 232, 255, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(108, 99, 255, 0.16)',
  },
  stripTitleBone: {
    width: 56,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  stripRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  stripCell: { alignItems: 'center', width: STRIP_AVATAR + 16 },
  stripRing: {
    width: STRIP_AVATAR + 6,
    height: STRIP_AVATAR + 6,
    borderRadius: (STRIP_AVATAR + 6) / 2,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(108, 99, 255, 0.16)',
  },
  stripNameBone: {
    marginTop: 8,
    width: 44,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 101, 132, 0.12)',
  },
  recentBone: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    width: 88,
    height: 34,
    borderRadius: radius.button,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.14)',
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 6,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.12)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  cardBody: { flex: 1, gap: 8 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  nameBone: {
    flex: 1,
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
    maxWidth: '55%',
  },
  timeBone: {
    width: 44,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.12)',
  },
  previewBone: {
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    width: '92%',
  },
  previewBoneShort: {
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    width: '68%',
  },
});
