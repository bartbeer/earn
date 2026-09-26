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
 * Changes a child's reward type. The server rejects this while the child
 * has an active chore or any recorded chore_occurrences history (see the
 * reward-type guard trigger) — there's no safe way to reinterpret an
 * already-recorded amount_cents across a unit change, so the caller should
 * expect this to throw in that case. forceSwitchChildRewardType() is the
 * explicit, destructive escape hatch for when a parent wants to override
 * that and clear the history instead.
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
 * Overrides the reward-type lock by permanently deleting this child's
 * chore_occurrences/weekly_allowances history (chore definitions are only
 * deactivated, matching section 43 everywhere else) and switching the
 * type. Requested explicitly by the user — this is real, irreversible data
 * loss, so callers must get an unambiguous destructive confirmation first,
 * never call this as a silent fallback. The server still refuses outright
 * if a paid week exists for this child; that boundary has no override.
 */
export async function forceSwitchChildRewardType(
  childId: string,
  rewardType: RewardType,
): Promise<void> {
  const { error } = await supabase.rpc('force_switch_child_reward_type', {
    p_child_id: childId,
    p_reward_type: rewardType,
  });
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

/**
 * Generates a new 6-digit join code for the family, replacing any existing
 * one. The plaintext is returned exactly once here — the server only ever
 * stores its hash (section 79), so there's no way to "look up" a
 * previously generated code again; regenerate instead.
 */
export async function rotateFamilyJoinCode(familyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_family_join_code', {
    p_family_id: familyId,
  });
  if (error) throw error;
  return data as string;
}

export interface JoinCodeChild {
  id: string;
  name: string;
}

export interface ResolvedJoinCode {
  familyName: string;
  children: JoinCodeChild[];
}

interface ResolveJoinCodeRow {
  family_id: string;
  family_name: string;
  // null on the sentinel row returned when the code is valid but every
  // child is already claimed — see resolve_family_join_code's own comment.
  child_id: string | null;
  child_name: string | null;
}

/**
 * Looks up what a join code resolves to — which family, and which of its
 * children haven't been claimed by a user account yet — without joining
 * anything. Callable by any signed-in user, including one who doesn't
 * belong to a family yet.
 *
 * The RPC itself never throws for "the code doesn't resolve to anything"
 * (rate-limited, so it deliberately returns zero rows instead of raising —
 * see the migration's own comment on why raising there would silently undo
 * its own attempt-tracking write); this wrapper is what turns "zero rows"
 * back into a thrown error, keeping the same external contract callers
 * already expect.
 */
export async function resolveFamilyJoinCode(joinCode: string): Promise<ResolvedJoinCode> {
  const { data, error } = await supabase.rpc('resolve_family_join_code', {
    p_join_code: joinCode,
  });
  if (error) throw error;
  const rows = (data ?? []) as ResolveJoinCodeRow[];
  if (rows.length === 0) {
    throw new Error('Invalid or expired join code');
  }
  return {
    familyName: rows[0].family_name,
    children: rows
      .filter((row): row is ResolveJoinCodeRow & { child_id: string; child_name: string } =>
        row.child_id !== null,
      )
      .map((row) => ({ id: row.child_id, name: row.child_name })),
  };
}

/**
 * The actual join: links the signed-in user's account to a specific child
 * within the family the code resolves to. Re-validates the code
 * server-side rather than trusting an earlier resolveFamilyJoinCode call
 * is still good (section 77).
 *
 * Same reasoning as resolveFamilyJoinCode: the RPC returns false rather
 * than throwing for "the code doesn't resolve to anything" (rate-limiting
 * reasons), so this wrapper turns that back into a thrown error to keep
 * the same external contract. Every other failure (wrong child, already
 * claimed, already belongs to a family) still throws directly from the
 * RPC, unchanged.
 */
export async function joinFamilyAsChild(joinCode: string, childId: string): Promise<void> {
  const { data, error } = await supabase.rpc('join_family_as_child', {
    p_join_code: joinCode,
    p_child_id: childId,
  });
  if (error) throw error;
  if (data === false) {
    throw new Error('Invalid or expired join code');
  }
}

/**
 * Whether this family currently has a Parent PIN set — used to decide
 * whether Settings' parent sections should be gated at all. Callable by
 * any family member (not just parents): it's a harmless boolean, and the
 * app never actually needs to ask a child for the PIN since they can't
 * see the gated sections in the first place.
 */
export async function hasParentPin(familyId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_parent_pin', { p_family_id: familyId });
  if (error) throw error;
  return data as boolean;
}

/**
 * Checks a guess against the family's Parent PIN. Returns false for a
 * wrong guess (a routine, expected outcome — not an error) and true if no
 * PIN is set at all, matching set_parent_pin/verify_parent_pin's own
 * "nothing to gate" behavior server-side.
 */
export async function verifyParentPin(familyId: string, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_parent_pin', {
    p_family_id: familyId,
    p_pin: pin,
  });
  if (error) throw error;
  return data as boolean;
}

/** Sets or changes the family's Parent PIN (4-6 digits). Parent-only. */
export async function setParentPin(familyId: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('set_parent_pin', { p_family_id: familyId, p_pin: pin });
  if (error) throw error;
}

/** Removes the Parent PIN — Settings' parent sections stop being gated. */
export async function clearParentPin(familyId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_parent_pin', { p_family_id: familyId });
  if (error) throw error;
}
