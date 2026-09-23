-- Phase 6: the completion RPC. chore_occurrences has had SELECT-only RLS
-- since Phase 2 by design — a raw UPDATE policy permissive enough to let a
-- child flip `status` would also let them rewrite amount_cents_snapshot in
-- the same request, which is exactly the attack section 75 calls out. This
-- is the narrow, purpose-built function that path was always meant to be.
--
-- earned_cents is recomputed from a fresh SUM of completed occurrences,
-- never incremented — this is what makes double-tap and network-retry
-- duplication safe by construction rather than needing separate
-- protection: re-running the same toggle twice just recomputes the same
-- number, and even two concurrent calls just leave the row at whichever
-- state committed last (standard, predictable last-write-wins — see
-- section 65's requirement that behaviour "remain predictable" under
-- concurrent devices, not that conflicts be perfectly merged).
create function public.set_occurrence_completion(p_occurrence_id uuid, p_completed boolean)
returns chore_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurrence chore_occurrences;
begin
  select * into v_occurrence from chore_occurrences where id = p_occurrence_id;
  if v_occurrence.id is null then
    raise exception 'Occurrence not found';
  end if;

  if not (
    public.is_family_parent(v_occurrence.family_id)
    or public.is_own_child_membership(v_occurrence.family_id, v_occurrence.child_id)
  ) then
    raise exception 'Not authorized to modify this occurrence';
  end if;

  -- A paid week is a closed historical record (sections 48-49) — its
  -- occurrences must never change after the fact, in either direction.
  if exists (
    select 1 from weekly_allowances wa
    where wa.child_id = v_occurrence.child_id
      and v_occurrence.scheduled_date between wa.week_start and wa.week_end
      and wa.payment_status = 'paid'
  ) then
    raise exception 'This week has already been paid and can no longer be changed';
  end if;

  update chore_occurrences
  set status = case when p_completed then 'completed' else 'pending' end,
      completed_at = case when p_completed then now() else null end,
      completed_by = case when p_completed then auth.uid() else null end
  where id = p_occurrence_id
  returning * into v_occurrence;

  update weekly_allowances wa
  set earned_cents = coalesce((
        select sum(co.amount_cents_snapshot)
        from chore_occurrences co
        where co.child_id = v_occurrence.child_id
          and co.scheduled_date between wa.week_start and wa.week_end
          and co.status = 'completed'
      ), 0),
      updated_at = now()
  where wa.child_id = v_occurrence.child_id
    and v_occurrence.scheduled_date between wa.week_start and wa.week_end;

  return v_occurrence;
end;
$$;

revoke execute on function public.set_occurrence_completion(uuid, boolean) from public;
grant execute on function public.set_occurrence_completion(uuid, boolean) to authenticated;
