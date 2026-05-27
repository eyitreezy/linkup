/**
 * Creator edit rules — mirrors RLS `plan_row_locked_for_creator_edit` (except escrow disputed;
 * server will reject if disputed) and PM policy: financials frozen after offers accepted path.
 */
import { computeUrgencyLevel } from '@/lib/plans/moodPlanComputations';
import { MIN_ESCROW_CENTS } from '@/lib/plans/planFinancialConfig';
import type { DbPlan, EscrowPattern } from '@/types/database';

export type PlanVisibility = DbPlan['visibility'];

export type CreatorEditCapabilities = {
  canEdit: boolean;
  lockReason: string | null;
  /** Story / trust copy */
  titleDescriptionCategory: boolean;
  visibility: boolean;
  scheduleLocationDuration: boolean;
  /** mood_type + urgency (urgency recomputed when schedule changes) */
  moodPresentation: boolean;
  /** starting price, paid flag, escrow — normal plans only, no offers, no accept */
  financial: boolean;
};

export function isPlanRowLockedForCreatorEdit(
  plan: Pick<
    DbPlan,
    'archived_at' | 'is_expired' | 'is_mood_plan' | 'mood_expires_at' | 'status'
  >
): boolean {
  if (plan.archived_at != null) return true;
  if (plan.is_expired) return true;
  if (
    plan.is_mood_plan &&
    plan.mood_expires_at != null &&
    new Date(plan.mood_expires_at).getTime() <= Date.now()
  ) {
    return true;
  }
  if (plan.status === 'completed') return true;
  return false;
}

export function getCreatorEditCapabilities(plan: DbPlan, offersCount: number): CreatorEditCapabilities {
  if (isPlanRowLockedForCreatorEdit(plan)) {
    let lockReason: string | null = 'This plan can’t be edited in its current state.';
    if (plan.archived_at) lockReason = 'Unarchive this plan before editing.';
    else if (plan.is_expired || (plan.is_mood_plan && plan.mood_expires_at && new Date(plan.mood_expires_at) <= new Date()))
      lockReason = 'Mood window ended — duplicate to create a fresh listing.';
    else if (plan.status === 'completed') lockReason = 'Completed plans are read-only.';
    return {
      canEdit: false,
      lockReason,
      titleDescriptionCategory: false,
      visibility: false,
      scheduleLocationDuration: false,
      moodPresentation: false,
      financial: false,
    };
  }

  const hasAccept = plan.accepted_offer_id != null;
  const hasOffers = offersCount > 0;
  const mood = !!plan.is_mood_plan;

  if (hasAccept) {
    return {
      canEdit: true,
      lockReason: null,
      titleDescriptionCategory: true,
      visibility: false,
      scheduleLocationDuration: false,
      moodPresentation: false,
      financial: false,
    };
  }

  return {
    canEdit: true,
    lockReason: null,
    titleDescriptionCategory: true,
    visibility: true,
    scheduleLocationDuration: true,
    moodPresentation: mood,
    financial: !mood && !hasOffers,
  };
}

export type BuildPatchInput = {
  title: string;
  description: string;
  category: string;
  visibility: PlanVisibility;
  scheduledAt: Date | null;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  durationMinutes: string;
  moodType: string;
  isPaid: boolean;
  startingPriceNgn: string;
  escrowPattern: EscrowPattern | null;
  hostContributionBps: number | null;
};

export function buildCreatorPlanPatch(
  plan: DbPlan,
  offersCount: number,
  form: BuildPatchInput
): { patch: Record<string, unknown>; error: string | null } {
  const caps = getCreatorEditCapabilities(plan, offersCount);
  if (!caps.canEdit) return { patch: {}, error: caps.lockReason ?? 'Not editable' };

  const patch: Record<string, unknown> = {};

  if (caps.titleDescriptionCategory) {
    const t = form.title.trim();
    if (!t) return { patch: {}, error: 'Title is required.' };
    patch.title = t;
    patch.description = form.description.trim() || null;
    patch.category = form.category.trim() || null;
  }

  if (caps.visibility) {
    patch.visibility = form.visibility;
  }

  if (caps.scheduleLocationDuration) {
    if (!form.scheduledAt) return { patch: {}, error: 'Set a date and time for the meetup.' };
    patch.scheduled_at = form.scheduledAt.toISOString();
    patch.location_label = form.locationLabel.trim() || null;
    patch.latitude = form.latitude;
    patch.longitude = form.longitude;
    const dm = parseInt(form.durationMinutes.trim(), 10);
    patch.duration_minutes = Number.isFinite(dm) && dm > 0 ? dm : null;
  }

  if (caps.moodPresentation && plan.is_mood_plan) {
    const mt = form.moodType.trim();
    if (!mt) return { patch: {}, error: 'Mood type is required for mood plans.' };
    patch.mood_type = mt;
    const schedIso = (patch.scheduled_at as string | undefined) ?? plan.scheduled_at;
    if (plan.mood_expires_at && schedIso) {
      patch.urgency_level = computeUrgencyLevel(new Date(plan.mood_expires_at), new Date(schedIso));
    }
  }

  if (caps.financial) {
    const paid = form.isPaid;
    patch.is_paid = paid;
    if (paid) {
      const raw = form.startingPriceNgn.trim();
      const n = Number(raw);
      const cents = Math.round(n * 100);
      if (!raw || Number.isNaN(n)) return { patch: {}, error: 'Enter a valid price in NGN.' };
      if (cents < MIN_ESCROW_CENTS) {
        return {
          patch: {},
          error: `Minimum paid amount is ₦${MIN_ESCROW_CENTS / 100}.`,
        };
      }
      if (!form.escrowPattern) return { patch: {}, error: 'Choose an escrow pattern.' };
      patch.starting_price_cents = cents;
      patch.budget_min_cents = cents;
      patch.budget_max_cents = cents;
      patch.budget_tier = plan.budget_tier ?? 'mid';
      patch.escrow_pattern = form.escrowPattern;
      patch.host_contribution_bps =
        form.escrowPattern === 'B' ? form.hostContributionBps ?? 5000 : null;
    } else {
      patch.starting_price_cents = null;
      patch.budget_min_cents = null;
      patch.budget_max_cents = null;
      patch.budget_tier = null;
      patch.escrow_pattern = null;
      patch.host_contribution_bps = null;
    }
  }

  return { patch, error: null };
}
