-- Phase 5: recurrence generation. Turns active chores + their schedules
-- into real chore_occurrences rows for the current week, and keeps each
-- child's weekly_allowances.maximum_cents in sync with what actually got
-- generated.
--
-- Deliberately no parallel TypeScript reimplementation of this logic (the
-- spec suggests a generateRecurrenceDates() pure function) — a second copy
-- of "which dates match this schedule" is exactly the kind of dual source
-- of truth that caused the profiles.role bug class fixed back in Phase 2.
-- This lives in SQL, tested directly via pgTAP against the real function.

-- ---------------------------------------------------------------------------
-- week_start_containing — pure date math, no table access. Given a date and
-- a week-start weekday (0=Sun..6=Sat, matching family_settings.week_start_day
-- and the app's day_of_week convention throughout), returns the Monday (or
-- whichever weekday) that starts the week containing it.
-- ---------------------------------------------------------------------------
create function public.week_start_containing(p_date date, p_week_start_day int)
returns date
language sql
immutable
as $$
  select p_date - (((extract(dow from p_date)::int - p_week_start_day + 7) % 7))::int;
$$;

grant execute on function public.week_start_containing(date, int) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- family_local_date — the calendar date a given instant falls on on family's
-- own clock (section 47: family timezone is authoritative for scheduling,
-- never the server's UTC clock). Deliberately SECURITY INVOKER (the
-- default): family_settings already has a SELECT policy letting a member
-- read their own family's timezone, so this needs no elevated privilege
-- when called directly — and when called from inside the SECURITY DEFINER
-- generation function below, it naturally inherits that function's already-
-- elevated context, so it still works there too.
-- ---------------------------------------------------------------------------
create function public.family_local_date(p_family_id uuid, p_instant timestamptz)
returns date
language sql
stable
as $$
  select (p_instant at time zone (select timezone from public.family_settings where family_id = p_family_id))::date;
$$;

grant execute on function public.family_local_date(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- _generate_week_occurrences — the actual generation logic. Takes an
-- explicit "as of" instant rather than reading now() itself, purely so
-- pgTAP tests can exercise month/year-boundary and timezone behaviour
-- deterministically. NOT granted to authenticated — see the public wrapper
-- below, which is the only way a real client ever reaches this.
-- ---------------------------------------------------------------------------
create function public._generate_week_occurrences(p_family_id uuid, p_as_of timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timezone text;
  v_week_start_day int;
  v_today date;
  v_week_start date;
  v_week_end date;
  v_chore record;
  v_day_offset int;
  v_date date;
begin
  select timezone, week_start_day into v_timezone, v_week_start_day
  from family_settings where family_id = p_family_id;

  v_today := (p_as_of at time zone v_timezone)::date;
  v_week_start := public.week_start_containing(v_today, v_week_start_day);
  v_week_end := v_week_start + 6;

  for v_chore in
    select
      c.id,
      c.child_id,
      c.name,
      c.amount_cents,
      c.recurrence_type,
      (c.created_at at time zone v_timezone)::date as created_date,
      coalesce(array_agg(cs.day_of_week) filter (where cs.day_of_week is not null), '{}') as days
    from chores c
    left join chore_schedule cs on cs.chore_id = c.id
    where c.family_id = p_family_id and c.active = true
    group by c.id
  loop
    for v_day_offset in 0..6 loop
      v_date := v_week_start + v_day_offset;

      -- Never backdate an occurrence to before the chore existed (section
      -- 66 "chore created mid-week"): a chore created on Wednesday must not
      -- retroactively owe Monday/Tuesday. Existing chores (created before
      -- this week) are unaffected — their created_date is <= v_week_start,
      -- so every day of the week is eligible.
      continue when v_date < v_chore.created_date;

      continue when not (
        v_chore.recurrence_type = 'daily'
        or extract(dow from v_date)::int = any(v_chore.days)
      );

      insert into chore_occurrences (
        family_id, chore_id, child_id, scheduled_date,
        chore_name_snapshot, amount_cents_snapshot
      ) values (
        p_family_id, v_chore.id, v_chore.child_id, v_date,
        v_chore.name, v_chore.amount_cents
      )
      -- Idempotency: the unique(chore_id, child_id, scheduled_date)
      -- constraint from Phase 2 already prevents duplicates outright; this
      -- just makes re-running generation a safe no-op instead of an error.
      on conflict (chore_id, child_id, scheduled_date) do nothing;
    end loop;
  end loop;

  -- Recompute maximum/earned from whatever occurrences actually exist for
  -- the week. This only ever grows maximum_cents (occurrences are additive-
  -- only — nothing here deletes or edits an existing one), and stays a
  -- no-op on repeated calls, matching the idempotency requirement.
  insert into weekly_allowances (family_id, child_id, week_start, week_end, maximum_cents, earned_cents)
  select
    p_family_id,
    co.child_id,
    v_week_start,
    v_week_end,
    sum(co.amount_cents_snapshot),
    -- coalesce: SUM(...) FILTER(...) is NULL, not 0, when nothing matches
    -- the filter (e.g. a brand new week with zero completions yet) —
    -- earned_cents is NOT NULL, so this isn't just style.
    coalesce(sum(co.amount_cents_snapshot) filter (where co.status = 'completed'), 0)
  from chore_occurrences co
  where co.family_id = p_family_id
    and co.scheduled_date between v_week_start and v_week_end
  group by co.child_id
  on conflict (child_id, week_start) do update
    set maximum_cents = excluded.maximum_cents,
        earned_cents = excluded.earned_cents,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_current_week_occurrences — the real public RPC surface. Always
-- uses the real clock (a client can never supply its own "as of" and fake
-- what day it is), and checks the caller actually belongs to the family
-- before doing any work.
-- ---------------------------------------------------------------------------
create function public.generate_current_week_occurrences(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'Not a member of this family';
  end if;
  perform public._generate_week_occurrences(p_family_id, now());
end;
$$;

revoke execute on function public.generate_current_week_occurrences(uuid) from public;
grant execute on function public.generate_current_week_occurrences(uuid) to authenticated;
