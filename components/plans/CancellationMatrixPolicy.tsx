import { CancellationPolicyRows } from '@/components/plans/CancellationPolicyRows';
import { colors, spacing, fonts } from '@/constants/theme';
import {
  fetchCancellationMatrix,
  matrixRowToPolicyTableRow,
  splitMatrixRows,
  type CancellationMatrixPlanType,
} from '@/lib/plans/cancellationMatrixDisplay';
import type { EscrowPattern } from '@/types/database';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  planType: CancellationMatrixPlanType;
  escrowPattern?: EscrowPattern | null;
  dense?: boolean;
};

export function CancellationMatrixPolicy({ planType, escrowPattern, dense }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timingRows, setTimingRows] = useState<ReturnType<typeof matrixRowToPolicyTableRow>[]>([]);
  const [noShowRows, setNoShowRows] = useState<ReturnType<typeof matrixRowToPolicyTableRow>[]>([]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(false);
    void fetchCancellationMatrix(planType, escrowPattern)
      .then((rows) => {
        if (cancel) return;
        const split = splitMatrixRows(rows);
        setTimingRows(split.timingRows.map(matrixRowToPolicyTableRow));
        setNoShowRows(split.noShowRows.map(matrixRowToPolicyTableRow));
      })
      .catch(() => {
        if (!cancel) setError(true);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [planType, escrowPattern]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || (!timingRows.length && !noShowRows.length)) {
    return (
      <Text style={styles.errorText}>
        Cancellation policy is temporarily unavailable. Please try again later.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {timingRows.length ? <CancellationPolicyRows rows={timingRows} dense={dense} /> : null}
      {noShowRows.length ? (
        <View style={styles.noShowSection}>
          <Text style={styles.noShowTitle}>No-show consequences</Text>
          <CancellationPolicyRows rows={noShowRows} dense={dense} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  loading: { paddingVertical: spacing.md, alignItems: 'center' },
  errorText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  noShowSection: { marginTop: spacing.sm, gap: spacing.xs },
  noShowTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
});
