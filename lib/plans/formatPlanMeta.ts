import type { DbPlan } from '@/types/database';
import { platformFeeCentsForAmount } from './planFinancialConfig';

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

/** Plan creation date for Meetup details meta card. */
export function formatPlanCreated(plan: DbPlan): string {
  const iso = plan.created_at;
  if (!iso) return 'Recently';
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return 'Recently';

  const diffMs = Date.now() - created.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Created today';
  if (days === 1) return 'Created yesterday';
  if (days < 14) return `Created ${days} days ago`;

  const formatted = created.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: created.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
  return `Created • ${formatted}`;
}

export function formatPlanAppFee(plan: DbPlan): string | null {
  if (plan.starting_price_cents == null || plan.starting_price_cents <= 0) return null;
  const feeCents = platformFeeCentsForAmount(plan.starting_price_cents);
  const v = (feeCents / 100).toFixed(0);
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
