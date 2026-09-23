-- Fixes a real bug found by hand-testing the app as a seeded child account:
-- signing in as Emma (a family of 3 members: one parent, two children) sent
-- the app the PARENT's role instead of Emma's own. Root cause, confirmed
-- against the running instance:
--
--   1. The "members can view memberships in their family" SELECT policy let
--      ANY member read EVERY membership row in the family (it checked
--      `is_family_member(family_id)`, which is true for the whole family,
--      not `this row belongs to me`).
--   2. fetchMembership() in src/lib/api/family.ts queried with `.limit(1)`
--      and no explicit filter or ordering, so it non-deterministically
--      returned whichever row Postgres happened to return first — in this
--      case the parent's, inserted before Emma's own row by seed.sql.
--
-- Fixed in two places: this migration narrows the policy to "a member sees
-- only their own membership row" (no product feature ever needed broader
-- visibility here — see the grep-through done before writing this
-- migration), and the app query now also filters explicitly to the calling
-- user's own id, so it no longer depends on RLS breadth for correctness
-- either. Belt and suspenders on purpose: this is exactly the kind of bug
-- that hiding behind "well, RLS will still narrow it eventually" invites.

-- The "co-members' profiles" policy on `profiles` reads family_memberships
-- itself (to find who else shares a family with the caller), so narrowing
-- family_memberships' own SELECT policy first would silently break it —
-- replace it with a SECURITY DEFINER check that reads the raw table
-- (bypassing RLS, same pattern as is_family_member/is_family_parent) so it
-- keeps working independent of family_memberships' row-visibility policy.
create function public.shares_family_with(p_other_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.family_memberships mine
    join public.family_memberships theirs on theirs.family_id = mine.family_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_other_user_id
  );
$$;

revoke execute on function public.shares_family_with(uuid) from public;
grant execute on function public.shares_family_with(uuid) to authenticated;

drop policy "users can view co-members' profiles" on public.profiles;

create policy "users can view co-members' profiles"
  on public.profiles for select
  using (public.shares_family_with(profiles.id));

-- Now safe to narrow: a member can see their own membership row, full stop.
drop policy "members can view memberships in their family" on public.family_memberships;

create policy "a user can view their own membership row"
  on public.family_memberships for select
  using (user_id = auth.uid());
