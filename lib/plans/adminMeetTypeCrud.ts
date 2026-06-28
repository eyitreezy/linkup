import type { SupabaseClient } from '@supabase/supabase-js';
import { inferMeetTypeIcon } from '@/lib/plans/inferMeetTypeIcon';
import { invalidateMeetTypesCache } from '@/lib/plans/meetTypes';
import { countPlansUsingMeetType } from '@/lib/plans/userMeetTypeCrud';
import type { DbMeetType, EscrowPattern } from '@/types/database';

function slugBase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'meetup';
}

export type AdminMeetTypeInput = {
  name: string;
  slug?: string;
  description?: string | null;
  meet_type_images?: string | null;
  icon?: string | null;
  default_duration_minutes?: number;
  sort_order?: number;
  is_active?: boolean;
  supports_mood?: boolean;
  is_restricted?: boolean;
  default_pattern?: EscrowPattern | null;
};

export type AdminMeetTypeRow = DbMeetType & {
  creator_display_name?: string | null;
};

export async function fetchAllMeetTypesAdmin(
  client: SupabaseClient
): Promise<{ rows: AdminMeetTypeRow[]; error: string | null }> {
  const { data, error } = await client
    .from('meet_types')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { rows: [], error: error.message };

  const rows = (data ?? []) as DbMeetType[];
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];

  let creatorNames = new Map<string, string | null>();
  if (creatorIds.length > 0) {
    const { data: profiles, error: profileErr } = await client
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', creatorIds);

    if (profileErr) return { rows: [], error: profileErr.message };
    creatorNames = new Map((profiles ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? null]));
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      creator_display_name: row.created_by ? creatorNames.get(row.created_by) ?? null : null,
    })),
    error: null,
  };
}

/** Meet type created by a member (not admin/seed catalog). */
export function isUserCreatedMeetType(type: DbMeetType): boolean {
  return !!type.created_by;
}

/** Seed catalog, migration seeds, or admin-managed catalog rows. */
export function isAdminCatalogMeetType(type: DbMeetType): boolean {
  return !type.created_by;
}

/** Next sort slot for a new admin catalog row (max existing + 10). */
export function nextAdminMeetTypeSortOrder(rows: Pick<DbMeetType, 'sort_order'>[]): number {
  const max = rows.reduce((acc, row) => Math.max(acc, row.sort_order ?? 0), 0);
  return max + 10;
}

export async function adminCreateMeetType(
  client: SupabaseClient,
  input: AdminMeetTypeInput
): Promise<{ row: DbMeetType | null; error: string | null }> {
  const name = input.name.trim();
  if (!name) return { row: null, error: 'Name is required.' };

  const slug = (input.slug?.trim() || slugBase(name)).slice(0, 64);
  const icon = (input.icon?.trim() || inferMeetTypeIcon(name)) as string;

  const { data, error } = await client
    .from('meet_types')
    .insert({
      name,
      slug,
      description: input.description?.trim() || null,
      meet_type_images: input.meet_type_images?.trim() || null,
      icon,
      default_duration_minutes: input.default_duration_minutes ?? 120,
      allows_escrow: true,
      allowed_patterns: ['A', 'B', 'C'],
      default_pattern: input.default_pattern ?? 'A',
      is_restricted: input.is_restricted ?? false,
      supports_mood: input.supports_mood ?? false,
      sort_order: input.sort_order ?? 500,
      is_active: input.is_active ?? true,
      approval_status: 'approved',
      is_admin_managed: true,
      created_by: null,
    })
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  invalidateMeetTypesCache();
  return { row: data as DbMeetType, error: null };
}

export async function adminUpdateMeetType(
  client: SupabaseClient,
  meetTypeId: string,
  input: AdminMeetTypeInput
): Promise<{ row: DbMeetType | null; error: string | null }> {
  const name = input.name.trim();
  if (!name) return { row: null, error: 'Name is required.' };

  const patch: Record<string, unknown> = {
    name,
    description: input.description?.trim() || null,
    meet_type_images: input.meet_type_images?.trim() || null,
    icon: (input.icon?.trim() || inferMeetTypeIcon(name)) as string,
    default_duration_minutes: input.default_duration_minutes ?? 120,
    is_active: input.is_active ?? true,
    supports_mood: input.supports_mood ?? false,
    is_restricted: input.is_restricted ?? false,
    default_pattern: input.default_pattern ?? 'A',
  };

  if (input.sort_order !== undefined) {
    patch.sort_order = input.sort_order;
  }

  if (input.slug?.trim()) {
    patch.slug = input.slug.trim().slice(0, 64);
  }

  const { data, error } = await client
    .from('meet_types')
    .update(patch)
    .eq('id', meetTypeId)
    .select('*')
    .single();

  if (error) return { row: null, error: error.message };
  invalidateMeetTypesCache();
  return { row: data as DbMeetType, error: null };
}

export async function adminSetMeetTypeActive(
  client: SupabaseClient,
  meetTypeId: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const { error } = await client.from('meet_types').update({ is_active: isActive }).eq('id', meetTypeId);
  if (error) return { error: error.message };
  invalidateMeetTypesCache();
  return { error: null };
}

export type AdminDeleteMeetTypeResult = {
  error: string | null;
  blockedByPlans?: boolean;
  planCount?: number;
};

export async function adminDeleteMeetType(
  client: SupabaseClient,
  meetTypeId: string
): Promise<AdminDeleteMeetTypeResult> {
  const { count, error: countErr } = await countPlansUsingMeetType(client, meetTypeId);
  if (countErr) return { error: countErr };
  if (count > 0) {
    return { error: null, blockedByPlans: true, planCount: count };
  }

  const { error } = await client.from('meet_types').delete().eq('id', meetTypeId);
  if (error) return { error: error.message };
  invalidateMeetTypesCache();
  return { error: null };
}

export function meetTypeOriginLabel(type: DbMeetType): string {
  if (type.is_admin_managed) return 'Admin catalog';
  if (type.created_by) return 'User';
  return 'Seed catalog';
}

export async function adminApproveMeetType(
  client: SupabaseClient,
  meetTypeId: string,
  meetTypeName: string,
  creatorId: string
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('meet_types')
    .update({ is_active: true, approval_status: 'approved' })
    .eq('id', meetTypeId);

  if (error) return { error: error.message };

  const { error: notifyErr } = await client.rpc('notify_user_meet_type_approved', {
    p_meet_type_id: meetTypeId,
    p_meet_type_name: meetTypeName,
    p_user_id: creatorId,
  });
  if (notifyErr) return { error: notifyErr.message };

  invalidateMeetTypesCache();
  return { error: null };
}

export async function adminRejectMeetType(
  client: SupabaseClient,
  meetTypeId: string,
  meetTypeName: string,
  creatorId: string,
  reason: string | null
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('meet_types')
    .update({ is_active: false, approval_status: 'rejected' })
    .eq('id', meetTypeId);

  if (error) return { error: error.message };

  const { error: notifyErr } = await client.rpc('notify_user_meet_type_rejected', {
    p_meet_type_id: meetTypeId,
    p_meet_type_name: meetTypeName,
    p_user_id: creatorId,
    p_reason: reason?.trim() || null,
  });
  if (notifyErr) return { error: notifyErr.message };

  invalidateMeetTypesCache();
  return { error: null };
}
