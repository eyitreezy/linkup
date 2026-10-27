import { pacePreferenceDisplayLabel } from '@/lib/matchmaker/pacePreference';
import { supabase } from '@/lib/supabase';

export type MatchMakerSettingsSummary = {
  communicationStyle: string | null;
  faithSet: boolean;
  familyGoals: string | null;
  pacePreference: string | null;
  dealbreakersSummary: string;
  poolVisible: boolean;
};

const COMM_LABELS: Record<string, string> = {
  daily: 'Daily contact',
  few_times_week: 'A few times a week',
  flexible: 'Flexible',
};

const FAMILY_LABELS: Record<string, string> = {
  yes_want_children: 'Wants children',
  open_to_it: 'Open to children',
  no_children: 'Does not want children',
  have_open_more: 'Has children, open to more',
  have_not_open_more: 'Has children, not open to more',
};

export function formatCommunicationStyle(value: string | null): string {
  if (!value) return 'Not set';
  return COMM_LABELS[value] ?? value;
}

export function formatFamilyGoals(value: string | null): string {
  if (!value) return 'Not set';
  return FAMILY_LABELS[value] ?? value.replace(/_/g, ' ');
}

export function formatPace(value: string | null): string {
  return pacePreferenceDisplayLabel(value);
}

export function summarizeDealbreakers(dealbreakers: Record<string, unknown> | null): string {
  if (!dealbreakers) return 'None set';
  const parts: string[] = [];
  if (dealbreakers.faith_alignment) parts.push('Faith alignment');
  if (dealbreakers.family_goals_align || dealbreakers.family_goals_alignment) {
    parts.push('Family goals');
  }
  if (dealbreakers.within_distance || dealbreakers.max_distance_km) parts.push('Distance');
  if (dealbreakers.within_age_range || dealbreakers.age_min || dealbreakers.age_max) {
    parts.push('Age range');
  }
  const other = dealbreakers.other;
  if (Array.isArray(other) && other.length > 0) parts.push('Custom');
  return parts.length ? parts.join(', ') : 'None set';
}

export async function fetchMatchMakerSettingsSummary(
  userId: string
): Promise<MatchMakerSettingsSummary> {
  const [{ data: profile }, { data: values }, visibilityRes] = await Promise.all([
    supabase.from('profiles').select('communication_style').eq('user_id', userId).maybeSingle(),
    supabase
      .from('matchmaker_values')
      .select('faith, family_goals, pace_preference, dealbreakers')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.rpc('matchmaker_get_pool_visibility'),
  ]);

  const visibilityPayload = visibilityRes.data as { visible?: boolean } | null;
  const poolVisible = visibilityPayload?.visible !== false;

  const db = (dealbreakers: unknown) =>
    dealbreakers && typeof dealbreakers === 'object'
      ? (dealbreakers as Record<string, unknown>)
      : null;

  return {
    communicationStyle: profile?.communication_style ?? null,
    faithSet: Boolean(values?.faith && values.faith !== 'prefer_not_to_say'),
    familyGoals: values?.family_goals ?? null,
    pacePreference: values?.pace_preference ?? null,
    dealbreakersSummary: summarizeDealbreakers(db(values?.dealbreakers)),
    poolVisible,
  };
}

export async function setPoolVisibility(visible: boolean): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_set_pool_visibility', { p_visible: visible });
  if (error) throw error;
}

export async function deleteMatchMakerProfile(): Promise<void> {
  const { error } = await supabase.rpc('matchmaker_delete_profile');
  if (error) throw error;
}
