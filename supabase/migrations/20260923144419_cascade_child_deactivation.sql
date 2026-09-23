-- Reported as "I cannot remove a child" — the children table already had
-- an `active` flag (fetchChildren() already filters on it, mirroring the
-- chores pattern), the "parents can update children" RLS policy already
-- permits setting it, but nothing in the app ever flipped it. This is the
-- missing half of an already-designed feature, not new scope.
--
-- Deactivating a child on its own would not have been enough: recurrence
-- generation only checks chores.active (see the Phase 5 migration), not
-- whether the owning child is still active, so it would have kept creating
-- new occurrences for a "removed" child indefinitely. This trigger
-- deactivates all of that child's chores when they're deactivated, which
-- in turn fires the existing chore-deactivation trigger
-- (cleanup_pending_occurrences_on_chore_deactivation) for each one —
-- pending occurrences get cleaned up and weekly_allowances recalculated
-- exactly as a direct chore deactivation would, with no logic duplicated.
create function public.cascade_child_deactivation_to_chores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active = false and old.active = true then
    update chores set active = false where child_id = new.id and active = true;
  end if;
  return new;
end;
$$;

create trigger children_cascade_deactivation_to_chores
  after update on public.children
  for each row execute function public.cascade_child_deactivation_to_chores();
