-- Fixes a real bug found by hand-testing: deactivating a chore correctly
-- stopped it from generating new occurrences, but left already-generated
-- PENDING occurrences sitting on the child's Week screen for the rest of
-- the week — deactivating a chore did nothing visible to the child at all.
--
-- Section 43 ("archive, don't delete") is about historical chore
-- definitions and occurrences surviving a chore's deactivation; it was
-- never meant to keep asking a child to do something the parent just
-- decided they don't need anymore. Fixed as a database trigger (not app
-- code) so it applies no matter which client path flips active=false —
-- consistent with "never trust the client" for anything that matters.
--
-- Two things are deliberately protected from this cleanup:
--   - COMPLETED occurrences are never removed. The child already did the
--     work and it already counted toward earned_cents; deactivating the
--     chore must never claw that back.
--   - A week already marked paid is left completely untouched (sections
--     48-49) — no occurrence deletion, no maximum/earned recalculation.
create function public.cleanup_pending_occurrences_on_chore_deactivation()
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
      and wa.payment_status = 'not_paid'
      and exists (
        select 1 from chore_occurrences co2
        where co2.child_id = wa.child_id
          and co2.scheduled_date between wa.week_start and wa.week_end
      );
  end if;
  return new;
end;
$$;

create trigger chores_cleanup_pending_occurrences_on_deactivation
  after update on public.chores
  for each row execute function public.cleanup_pending_occurrences_on_chore_deactivation();
