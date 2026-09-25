// Real Supabase reads/writes for family membership. Nothing here trusts a
// client-supplied role or family_id — every call rides on the signed-in
// user's own session, and RLS (see supabase/migrations) is the actual
// authorization boundary, not this file.
import { supabase } from '@/lib/supabase';
import type { Child, Membership, RewardType } from '@/types/domain';

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

/**
 * The signed-in user's own membership, or null if they belong to no family
 * yet. Takes userId explicitly and filters on it — RLS also restricts this
 * table to the caller's own row, but a real bug (fixed in migration
 * 20260923114930) showed that "just trust RLS to narrow it" isn't enough
 * on its own if RLS is ever loosened later: filter explicitly here too,
 * rather than relying on whichever row happens to come back first.
 */
export async function fetchMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('family_memberships')
    .select('family_id, role, child_id, families(name)')
    .eq('user_id', userId)
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

interface ChildRow {
  id: string;
  name: string;
  reward_type: RewardType;
}

function mapChild(row: ChildRow): Child {
  return { id: row.id, name: row.name, rewardType: row.reward_type };
}

export async function fetchChildren(familyId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('id, name, reward_type')
    .eq('family_id', familyId)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapChild);
}

export async function addChild(
  familyId: string,
  name: string,
  rewardType: RewardType,
): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .insert({ family_id: familyId, name, reward_type: rewardType })
    .select('id, name, reward_type')
    .single();
  if (error) throw error;
  return mapChild(data);
}

/**
 * Changes a child's reward type. The server rejects this once the child has
 * any chore (see the reward-type migration's guard trigger) — there's no
 * safe way to reinterpret an already-recorded amount_cents across a unit
 * change, so the caller should expect this to throw in that case and show a
 * clear explanation rather than a generic error.
 */
export async function updateChildRewardType(
  childId: string,
  rewardType: RewardType,
): Promise<void> {
  const { error } = await supabase
    .from('children')
    .update({ reward_type: rewardType })
    .eq('id', childId);
  if (error) throw error;
}

/**
 * Removes a child from view. Never deletes — a database trigger cascades
 * this into deactivating their chores too (which itself cascades into
 * cleaning up pending occurrences), so history survives exactly the way
 * deactivating a chore directly already preserves it (section 43).
 */
export async function deactivateChild(childId: string): Promise<void> {
  const { error } = await supabase.from('children').update({ active: false }).eq('id', childId);
  if (error) throw error;
}
