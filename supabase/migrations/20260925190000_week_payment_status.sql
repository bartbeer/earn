-- Phase 8: real payment tracking. "Mark as paid" / undo paid has been
-- UI-only since Phase 1-3 (see history/[weekId].tsx) — it reset on every
-- remount because nothing ever wrote it back. This is the narrow,
-- purpose-built function that path was always meant to become, matching
-- set_occurrence_completion's pattern: weekly_allowances has had SELECT-only
-- RLS since Phase 2 by design (a raw UPDATE policy permissive enough to let
-- a parent set payment_status would also let them set paid_amount_cents to
-- anything they like in the same request — the client must never supply
-- the paid amount, only the server's own current earned_cents can).
--
-- Marking paid is only allowed once a week has actually ended (family-local
-- date, section 47) — you can't pay out a week that's still in progress.
-- Undoing payment re-opens the week: set_occurrence_completion already
-- refuses to touch a paid week's occurrences, so undoing is the deliberate,
-- narrow way back to being able to correct a mistake, not a loophole around
-- that protection.
create function public.set_week_payment_status(p_weekly_allowance_id uuid, p_paid boolean)
returns weekly_allowances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row weekly_allowances%rowtype;
  v_timezone text;
  v_today date;
begin
  select * into v_row from weekly_allowances where id = p_weekly_allowance_id;
  if v_row.id is null then
    raise exception 'Week not found';
  end if;

  if not public.is_family_parent(v_row.family_id) then
    raise exception 'Not authorized to change this week''s payment status';
  end if;

  select timezone into v_timezone from family_settings where family_id = v_row.family_id;
  v_today := (now() at time zone v_timezone)::date;
  if v_row.week_end >= v_today then
    raise exception 'Cannot change payment status for a week that has not ended yet';
  end if;

  if p_paid then
    update weekly_allowances
    set payment_status = 'paid',
        paid_amount_cents = earned_cents,
        paid_at = now(),
        updated_at = now()
    where id = p_weekly_allowance_id
    returning * into v_row;
  else
    update weekly_allowances
    set payment_status = 'not_paid',
        paid_amount_cents = null,
        paid_at = null,
        updated_at = now()
    where id = p_weekly_allowance_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.set_week_payment_status(uuid, boolean) from public;
grant execute on function public.set_week_payment_status(uuid, boolean) to authenticated;
