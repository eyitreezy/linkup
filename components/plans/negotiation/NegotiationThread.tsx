import { colors, spacing, fonts, radius } from '@/constants/theme';
import {
  formatRelativeTime,
  formatRoundActionHeadline,
  formatRoundAmount,
  formatRoundRoleLabel,
} from '@/lib/plans/formatNegotiationRound';
import { subscribeOfferRoundsRealtime } from '@/lib/plans/subscribeOfferRoundsRealtime';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { DbPlanOfferRound } from '@/types/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

type Props = {
  offerId: string;
  planId: string;
  currentUserId?: string;
  currency: string;
  embedded?: boolean;
  refreshToken?: number;
};

function parseRoundNote(note: string): { suggestedLine: string | null; body: string | null } {
  const trimmed = note.trim();
  if (!trimmed) return { suggestedLine: null, body: null };

  if (!/^suggested:/i.test(trimmed)) {
    return { suggestedLine: null, body: trimmed };
  }

  const parts = trimmed.split(/\s*\|\s*/);
  const suggestedLine = parts[0]?.trim() || null;
  const body = parts.slice(1).join(' | ').trim() || null;
  return { suggestedLine, body };
}

function NoteText({
  children,
  style,
}: {
  children: string;
  style: object | object[];
}) {
  return (
    <Text
      style={style}
      {...Platform.select({
        android: { textBreakStrategy: 'simple' as const },
        default: {},
      })}
    >
      {children}
    </Text>
  );
}

function RoundRow({
  round,
  mine,
  currency,
  bubbleMaxWidth,
  embedded,
}: {
  round: DbPlanOfferRound;
  mine: boolean;
  currency: string;
  bubbleMaxWidth: number;
  embedded: boolean;
}) {
  const headline = formatRoundActionHeadline(round.action);
  const roleLabel = formatRoundRoleLabel(round.proposer_role, mine);
  const amountLabel = formatRoundAmount(round.amount_cents, currency);
  const relativeTime = formatRelativeTime(round.created_at);
  const { suggestedLine, body: noteBody } = round.note
    ? parseRoundNote(round.note)
    : { suggestedLine: null, body: null };

  return (
    <View
      style={[
        styles.roundRow,
        embedded
          ? [styles.roundRowEmbedded, mine ? styles.roundRowEmbeddedMine : styles.roundRowEmbeddedTheirs]
          : [mine ? styles.roundRowMine : styles.roundRowTheirs, { maxWidth: bubbleMaxWidth }],
      ]}
    >
      <View style={styles.roundRowContent}>
        <View style={styles.metaRow}>
          <Text
            style={[styles.roundRole, mine ? styles.roundRoleMine : styles.roundRoleTheirs]}
          >
            {roleLabel}
          </Text>
          <Text
            style={[styles.roundRelative, mine ? styles.roundRelativeMine : styles.roundRelativeTheirs]}
          >
            {relativeTime}
          </Text>
        </View>

        <NoteText style={[styles.roundAction, mine ? styles.roundActionMine : styles.roundActionTheirs]}>
          {headline}
        </NoteText>

        <NoteText style={[styles.roundAmount, mine ? styles.roundAmountMine : styles.roundAmountTheirs]}>
          {amountLabel}
        </NoteText>

        {suggestedLine ? (
          <NoteText
            style={[styles.roundSuggested, mine ? styles.roundSuggestedMine : styles.roundSuggestedTheirs]}
          >
            {suggestedLine}
          </NoteText>
        ) : null}

        {noteBody ? (
          <NoteText style={[styles.roundNote, mine ? styles.roundNoteMine : styles.roundNoteTheirs]}>
            {noteBody}
          </NoteText>
        ) : null}

        {!suggestedLine && !noteBody && round.note ? (
          <NoteText style={[styles.roundNote, mine ? styles.roundNoteMine : styles.roundNoteTheirs]}>
            {round.note}
          </NoteText>
        ) : null}
      </View>
    </View>
  );
}

export function NegotiationThread({
  offerId,
  currentUserId,
  currency,
  embedded,
  refreshToken,
}: Props) {
  const [rounds, setRounds] = useState<DbPlanOfferRound[]>([]);
  const { width: windowWidth } = useWindowDimensions();
  const bubbleMaxWidth = Math.min(320, Math.round(windowWidth * 0.82));

  const load = useCallback(async () => {
    if (!offerId || !isSupabaseConfigured) return;
    const { data } = await supabase
      .from('plan_offer_rounds')
      .select('*')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: true });
    if (data) setRounds(data as DbPlanOfferRound[]);
  }, [offerId]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (!offerId || !isSupabaseConfigured) return;
    return subscribeOfferRoundsRealtime({
      offerId,
      onRefresh: () => {
        void loadRef.current();
      },
    });
  }, [offerId]);

  if (rounds.length === 0) return null;

  return (
    <View style={[styles.thread, embedded && styles.threadEmbedded]}>
      <Text style={styles.threadTitle}>Negotiation history</Text>
      <View style={styles.roundList}>
        {rounds.map((round) => (
          <RoundRow
            key={round.id}
            round={round}
            mine={round.proposer_id === currentUserId}
            currency={currency}
            bubbleMaxWidth={bubbleMaxWidth}
            embedded={!!embedded}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    width: '100%',
  },
  threadEmbedded: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(216, 220, 230, 0.85)',
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  threadTitle: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  roundList: {
    gap: spacing.sm,
    width: '100%',
  },
  roundRow: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minWidth: 0,
  },
  roundRowContent: {
    width: '100%',
    maxWidth: '100%',
  },
  roundRowEmbedded: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  roundRowEmbeddedMine: {
    backgroundColor: '#1A1C1E',
  },
  roundRowEmbeddedTheirs: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(216, 220, 230, 0.75)',
  },
  roundRowMine: {
    alignSelf: 'flex-end',
    marginLeft: spacing.md,
    backgroundColor: '#1A1C1E',
  },
  roundRowTheirs: {
    alignSelf: 'flex-start',
    marginRight: spacing.md,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(216, 220, 230, 0.75)',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
    rowGap: 4,
    width: '100%',
    marginBottom: 8,
  },
  roundRole: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
  },
  roundRoleMine: {
    color: 'rgba(255, 255, 255, 0.65)',
  },
  roundRoleTheirs: {
    color: colors.textMuted,
  },
  roundRelative: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.medium,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  roundRelativeMine: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  roundRelativeTheirs: {
    color: colors.textMuted,
  },
  roundAction: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    lineHeight: 20,
    width: '100%',
    flexShrink: 1,
  },
  roundActionMine: {
    color: '#FFFFFF',
  },
  roundActionTheirs: {
    color: colors.text,
  },
  roundAmount: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
    lineHeight: 22,
    width: '100%',
    flexShrink: 1,
  },
  roundAmountMine: {
    color: '#FFFFFF',
  },
  roundAmountTheirs: {
    color: colors.primary,
  },
  roundSuggested: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
    lineHeight: 18,
    width: '100%',
    flexShrink: 1,
  },
  roundSuggestedMine: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  roundSuggestedTheirs: {
    color: colors.primary,
  },
  roundNote: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    lineHeight: 18,
    width: '100%',
    flexShrink: 1,
  },
  roundNoteMine: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
  roundNoteTheirs: {
    color: colors.textMuted,
  },
});
