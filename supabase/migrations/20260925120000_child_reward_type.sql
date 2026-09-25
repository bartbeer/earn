-- Extra feature (not in the original master spec): a parent can choose
-- whether a given child earns euros or stars — some parents don't want a
-- younger child working for real money at all. This is per child, not
-- per family, since siblings might reasonably use different units.
--
-- Reuses the existing amount_cents columns as-is rather than adding a
-- parallel set of star columns: for a 'stars' child, amount_cents is simply
-- interpreted as a whole star count instead of euro cents. Section 6's
-- integer-money discipline still holds either way — it's always a plain
-- non-negative integer, never a float; only the app layer's display unit
-- changes.

alter table public.children
  add column reward_type text not null default 'currency'
    check (reward_type in ('currency', 'stars'));

comment on column public.children.reward_type is
  'Whether this child''s amount_cents columns (chores, occurrences, weekly_allowances) mean euro cents or whole stars. Locked once the child has any chore — see children_guard_reward_type_change — so historical amounts already recorded in one unit never get silently reinterpreted in the other.';

-- ---------------------------------------------------------------------------
-- Reward type is frozen once a child has any chore, ever (active or
-- inactive). Chores/occurrences don't carry their own reward_type snapshot
-- the way they snapshot name/amount (section 42) — there would be no safe
-- way to reinterpret an existing amount_cents across a unit change, e.g. a
-- €2.50 chore silently reading as "250 stars". A BEFORE UPDATE trigger
-- enforces this regardless of write path (the existing "parents can update
-- children" policy already grants a blanket UPDATE on this table, same as
-- it does for `active`), so this can't be bypassed by skipping some
-- particular client code path.
-- ---------------------------------------------------------------------------
create function public.guard_child_reward_type_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reward_type is distinct from old.reward_type then
    if exists (select 1 from public.chores where child_id = old.id) then
      raise exception 'Cannot change reward type once this child has chores';
    end if;
  end if;
  return new;
end;
$$;

create trigger children_guard_reward_type_change
  before update on public.children
  for each row execute function public.guard_child_reward_type_change();
