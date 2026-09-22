// Real Supabase reads/writes for family membership. Nothing here trusts a
// client-supplied role or family_id — every call rides on the signed-in
// user's own session, and RLS (see supabase/migrations) is the actual
// authorization boundary, not this file.
import { supabase } from '@/lib/supabase';
import type { Child, Membership } from '@/types/domain';

interface MembershipRow {
  family_id: string;
  role: 'parent' | 'child';
  child_id: string | null;
  families: { name: string } | { name: string }[] | null;
}

function mapMembership(row: MembershipRow): Membership {
  // Supabase's JS client types a to-one embed as possibly an array
  // depending on how the relationship was inferred; handle both shapes.
  const family = Array.isArray(row.families) ? row.families[0] : row.families;
  return {
    familyId: row.family_id,
    familyName: family?.name ?? '',
    role: row.role,
    childId: row.child_id,
  };
}

/** The signed-in user's membership, or null if they belong to no family yet. */
export async function fetchMembership(): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('family_memberships')
    .select('family_id, role, child_id, families(name)')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMembership(data as MembershipRow) : null;
}

/**
 * Creates a family and enrolls the given user as its parent. Two separate
 * requests (not one transaction) — acceptable here because, unlike the
 * chore/payment RPCs, there's no sensitive server-computed value at stake;
 * a failure between the two just leaves an orphaned, harmless family row
 * the user can retry past.
 */
export async function createFamily(name: string, userId: string): Promise<Membership> {
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ name, created_by: userId })
    .select('id, name')
    .single();
  if (familyError) throw familyError;

  const { error: membershipError } = await supabase
    .from('family_memberships')
    .insert({ family_id: family.id, user_id: userId, role: 'parent' });
  if (membershipError) throw membershipError;

  return { familyId: family.id, familyName: family.name, role: 'parent', childId: null };
}

export async function fetchChildren(familyId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('id, name')
    .eq('family_id', familyId)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function addChild(familyId: string, name: string): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .insert({ family_id: familyId, name })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}
