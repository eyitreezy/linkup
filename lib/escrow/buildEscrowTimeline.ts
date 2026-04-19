import type { DbEscrowDispute, DbEscrowTransaction, DbPlan } from '@/types/database';

export type EscrowTimelineTone = 'done' | 'current' | 'pending' | 'warn';

export type EscrowTimelineItem = {
  key: string;
  title: string;
  subtitle?: string;
  at: string | null;
  tone: EscrowTimelineTone;
};

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : v;
}

export function buildEscrowTimeline(
  escrow: DbEscrowTransaction,
  plan: DbPlan | null,
  dispute: DbEscrowDispute | null
): EscrowTimelineItem[] {
  const meta = (escrow.metadata ?? {}) as Record<string, unknown>;
  const paymentInit = isoOrNull(meta.payment_initiated_at);
  const chargeConfirmed = isoOrNull(meta.charge_confirmed_at);

  const paid =
    escrow.status === 'funded' ||
    escrow.status === 'released' ||
    escrow.status === 'disputed' ||
    escrow.status === 'refunded';

  const paymentConfirmedAt = chargeConfirmed ?? (paid ? escrow.updated_at : null);

  const agreedAt = plan?.created_at ?? escrow.created_at;
  const meetCompleteAt = plan?.status === 'completed' ? plan.updated_at : null;

  const items: EscrowTimelineItem[] = [
    {
      key: 'agreed',
      title: 'Plan agreed',
      subtitle: 'Details were accepted for this paid meetup.',
      at: agreedAt,
      tone: 'done',
    },
    {
      key: 'pay_init',
      title: 'Payment initiated',
      subtitle: paymentInit ? 'Secure checkout was opened.' : paid ? 'Recorded when payment completed.' : undefined,
      at: paymentInit ?? (paid ? paymentConfirmedAt : null),
      tone: paid || paymentInit ? 'done' : escrow.status === 'pending_funding' ? 'current' : 'pending',
    },
    {
      key: 'pay_confirmed',
      title: 'Payment confirmed',
      subtitle: escrow.paystack_reference ? `Reference · ${escrow.paystack_reference}` : 'Funds held in escrow.',
      at: paymentConfirmedAt,
      tone: paid ? 'done' : 'pending',
    },
    {
      key: 'complete',
      title: 'Meetup completed',
      subtitle: 'Confirm when the plan happened as agreed.',
      at: meetCompleteAt,
      tone:
        plan?.status === 'completed'
          ? 'done'
          : paid && escrow.status === 'funded'
            ? 'current'
            : paid              ? 'pending'
              : 'pending',
    },
    {
      key: 'release',
      title: 'Funds released',
      subtitle: 'Released to the host after confirmation.',
      at: escrow.released_at,
      tone:
        escrow.status === 'released'
          ? 'done'
          : escrow.status === 'disputed'
            ? 'warn'
            : 'pending',
    },
  ];

  if (dispute) {
    items.push({
      key: 'dispute',
      title: 'Dispute in progress',
      subtitle: dispute.reason,
      at: dispute.created_at,
      tone: 'warn',
    });
  }

  return items;
}
