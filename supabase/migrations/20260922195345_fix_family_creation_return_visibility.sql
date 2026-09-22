-- Fixes a real bug found while wiring up the app's "create family" flow
-- (Phase 3): Postgres enforces the SELECT policy on the row(s) an
-- INSERT ... RETURNING produces, not just the INSERT's WITH CHECK. A brand
-- new user creating their first family has no family_memberships row yet,
-- so `is_family_member(id)` was false and the INSERT itself failed with
-- "new row violates row-level security policy" — confirmed against the
-- running local instance, not just reasoned about.
--
-- Fix: a user can always see a family they created, independent of
-- membership. This only widens visibility of the `families` row itself
-- (name + metadata) to its creator — every other table (children, chores,
-- occurrences, weekly_allowances, family_settings) still requires actual
-- family_membership, so this does not create a way to see a family's real
-- data without joining it.
drop policy "members can view their family" on public.families;

create policy "members or the creator can view their family"
  on public.families for select
  using (public.is_family_member(id) or created_by = auth.uid());

-- Same bug, same fix, for the membership row itself: inserting your own
-- family_memberships row and asking for it back via RETURNING was also
-- failing, because is_family_member() re-queries the table being written
-- to and — confirmed by testing, not just reasoned about — does not see
-- the row it is itself part of within the same statement's RETURNING
-- check. "A user can always see their own membership row" is also just a
-- more obviously correct policy on its own merits.
drop policy "members can view memberships in their family" on public.family_memberships;

create policy "members can view memberships in their family"
  on public.family_memberships for select
  using (public.is_family_member(family_id) or user_id = auth.uid());
