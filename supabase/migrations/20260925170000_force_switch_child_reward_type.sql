-- Explicit user request: "even if the chore is done, I need to be able to
-- switch for new chores to euro. In that case all finished chores in
-- history can be removed permanently for this child." This is a real,
-- deliberate override of the reward-type lock — not a bug fix — so it's a
-- separate, clearly-named function the app only calls after an explicit
-- destructive confirmation, never a fallback the normal switch quietly
-- takes on its own.
--
-- One line this does NOT cross even when asked: a *paid* week is never
-- touched. That's a real record of money/stars already given to the child,
-- not leftover chore-tracking data — the same boundary
-- cleanup_pending_occurrences_on_chore_deactivation already draws for
-- ordinary chore deactivation (sections 48-49).
create function public.force_switch_child_reward_type(p_child_id uuid, p_reward_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if p_reward_type not in ('currency', 'stars') then
    raise exception 'Invalid reward type';
  end if;

  select family_id into v_family_id from public.children where id = p_child_id;
  if v_family_id is null then
    raise exception 'Child not found';
  end if;
  if not public.is_family_parent(v_family_id) then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1 from public.weekly_allowances
    where child_id = p_child_id and payment_status = 'paid'
  ) then
    raise exception 'Cannot switch reward type: this child has a paid week on record, which is never deleted';
  end if;

  -- Wipes the child's chore history entirely (not just pending occurrences,
  -- unlike ordinary chore deactivation) and deactivates whatever chores are
  -- still active, so the parent starts clean under the new unit. Chore
  -- *definitions* themselves are left archived, not deleted, matching
  -- section 43 elsewhere — only the money-bearing occurrence/allowance
  -- records the user explicitly asked to clear are removed here.
  delete from public.chore_occurrences where child_id = p_child_id;
  delete from public.weekly_allowances where child_id = p_child_id;
  update public.chores set active = false where child_id = p_child_id and active = true;

  update public.children set reward_type = p_reward_type where id = p_child_id;
end;
$$;

revoke execute on function public.force_switch_child_reward_type(uuid, text) from public;
grant execute on function public.force_switch_child_reward_type(uuid, text) to authenticated;
