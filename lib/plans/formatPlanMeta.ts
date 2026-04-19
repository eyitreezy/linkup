import type { DbPlan } from '@/types/database';

export function formatPlanWhen(plan: DbPlan): string {
  const d = plan.scheduled_at ? new Date(plan.scheduled_at) : new Date(plan.created_at);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + `, ${time}`
  );
}

export function formatPlanPrice(plan: DbPlan): string | null {
  if (plan.starting_price_cents == null) return null;
  const v = (plan.starting_price_cents / 100).toFixed(0);
  return `${v} ${plan.currency}`;
}

/** Format stored ISO timestamp for agreement / detail screens. */
export function formatIsoDateTime(iso: string | null | undefined, fallback?: string): string {
  const raw = iso ?? fallback;
  if (!raw) return 'To be scheduled';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'To be scheduled';
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}
