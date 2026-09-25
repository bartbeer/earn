-- Reported by hand-testing: a parent created a stars child, added a chore,
-- deactivated it (never completed), the Week screen correctly showed no
-- chores left — but switching the child back to euros still failed with
-- "this child already has chores". Two real bugs, found together:
--
-- 1. cleanup_pending_occurrences_on_chore_deactivation's weekly_allowances
--    UPDATE was guarded by "only touch rows that still have some occurrence
--    overlapping them" — which is exactly backwards for the case where
--    deactivation removes the *last* occurrence: maximum_cents/earned_cents
--    were left stale at their pre-deactivation value instead of resetting
--    to 0. (chore_deactivation_cleanup_test.sql never caught this because
--    every existing scenario there leaves at least one completed occurrence
--    behind.)
--
-- 2. guard_child_reward_type_change locked reward_type based on "does a
--    chores row exist at all", including fully deactivated ones with zero
--    remaining occurrences — i.e. zero actual historical amounts anywhere.
--    The real invariant that needs protecting is "would switching silently
--    reinterpret a real recorded amount", which only chore_occurrences rows
--    (and an *active* chore, which could still generate one under the old
--    unit) actually represent.

create or replace function public.cleanup_pending_occurrences_on_chore_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active = false and old.active = true then
    delete from chore_occurrences co
    where co.chore_id = new.id
      and co.status = 'pending'
      and not exists (
        select 1 from weekly_allowances wa
        where wa.child_id = co.child_id
          and co.scheduled_date between wa.week_start and wa.week_end
          and wa.payment_status = 'paid'
      );

    -- Recalculates every not-paid week for this child from whatever
    -- occurrences actually remain, defaulting to 0 — not just the weeks
    -- that still have at least one left. A week left with zero occurrences
    -- must end up at maximum_cents = 0, not its stale pre-cleanup value.
    update weekly_allowances wa
    set maximum_cents = coalesce((
          select sum(co.amount_cents_snapshot)
          from chore_occurrences co
          where co.child_id = wa.child_id
            and co.scheduled_date between wa.week_start and wa.week_end
        ), 0),
        earned_cents = coalesce((
          select sum(co.amount_cents_snapshot)
          from chore_occurrences co
          where co.child_id = wa.child_id
            and co.scheduled_date between wa.week_start and wa.week_end
            and co.status = 'completed'
        ), 0),
        updated_at = now()
    where wa.child_id = new.child_id
      and wa.payment_status = 'not_paid';
  end if;
  return new;
end;
$$;

create or replace function public.guard_child_reward_type_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reward_type is distinct from old.reward_type then
    if exists (select 1 from public.chores where child_id = old.id and active = true)
       or exists (select 1 from public.chore_occurrences where child_id = old.id)
    then
      raise exception 'Cannot change reward type while this child has an active chore or any chore history';
    end if;
  end if;
  return new;
end;
$$;
