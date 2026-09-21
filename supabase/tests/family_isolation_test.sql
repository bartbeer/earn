-- Proves Family A can never see Family B's data, and that an unauthenticated
-- request sees nothing at all (master spec sections 57, 74). Fixture setup
-- runs as the connecting superuser (bypasses RLS); assertions run
-- impersonating specific users via the standard Supabase JWT-claim
-- simulation (set local role + set local request.jwt.claims), which is what
-- auth.uid() reads.
BEGIN;
SELECT no_plan();

-- Fixtures: two independent families, each with their own parent + child. --
insert into auth.users (id) values
  ('a0000000-0000-0000-0000-000000000001'), -- parent A
  ('b0000000-0000-0000-0000-000000000001'), -- parent B
  ('c0000000-0000-0000-0000-000000000001'); -- unrelated user, member of nothing

insert into public.families (id, name, created_by) values
  ('a0000000-0000-0000-0000-000000000002', 'Family A', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Family B', 'b0000000-0000-0000-0000-000000000001');

insert into public.family_memberships (family_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'parent'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'parent');

insert into public.children (id, family_id, name) values
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Child A'),
  ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Child B');

insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type) values
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Chore A', 100, 'daily'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'Chore B', 100, 'daily');

insert into public.chore_schedule (chore_id, day_of_week) values
  ('a0000000-0000-0000-0000-000000000004', 1),
  ('b0000000-0000-0000-0000-000000000004', 1);

insert into public.chore_occurrences (family_id, chore_id, child_id, scheduled_date, chore_name_snapshot, amount_cents_snapshot) values
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', '2026-09-21', 'Chore A', 100),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', '2026-09-21', 'Chore B', 100);

insert into public.weekly_allowances (family_id, child_id, week_start, week_end) values
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '2026-09-21', '2026-09-27'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', '2026-09-21', '2026-09-27');

-- Act as parent A -------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Positive control: parent A can still see their own family's data. Without
-- this, a suite of all-zero assertions below could pass even if RLS were
-- broken in a way that hides everything from everyone.
SELECT is((select count(*) from public.families), 1::bigint, 'parent A sees exactly their own family');
SELECT is((select count(*) from public.family_settings), 1::bigint, 'parent A sees exactly their own family settings');
SELECT is((select count(*) from public.children), 1::bigint, 'parent A sees exactly their own child');
SELECT is((select count(*) from public.chores), 1::bigint, 'parent A sees exactly their own chore');
SELECT is((select count(*) from public.chore_schedule), 1::bigint, 'parent A sees exactly their own chore schedule row');
SELECT is((select count(*) from public.chore_occurrences), 1::bigint, 'parent A sees exactly their own occurrence');
SELECT is((select count(*) from public.weekly_allowances), 1::bigint, 'parent A sees exactly their own weekly allowance');
SELECT is((select count(*) from public.family_memberships), 1::bigint, 'parent A sees exactly their own membership');

-- Negative: family B is invisible, including by direct id lookup (not just
-- "not in the list" — an attacker who already knows/guesses an id must
-- still be denied).
SELECT is((select count(*) from public.families where id = 'b0000000-0000-0000-0000-000000000002'), 0::bigint, 'parent A cannot read family B by id');
SELECT is((select count(*) from public.family_settings where family_id = 'b0000000-0000-0000-0000-000000000002'), 0::bigint, 'parent A cannot read family B''s settings by id');
SELECT is((select count(*) from public.children where id = 'b0000000-0000-0000-0000-000000000003'), 0::bigint, 'parent A cannot read family B''s child by id');
SELECT is((select count(*) from public.chores where id = 'b0000000-0000-0000-0000-000000000004'), 0::bigint, 'parent A cannot read family B''s chore by id');
SELECT is((select count(*) from public.chore_occurrences where family_id = 'b0000000-0000-0000-0000-000000000002'), 0::bigint, 'parent A cannot read family B''s occurrences');
SELECT is((select count(*) from public.weekly_allowances where family_id = 'b0000000-0000-0000-0000-000000000002'), 0::bigint, 'parent A cannot read family B''s weekly allowances');

reset role;

-- Act as a user who belongs to no family at all -------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is((select count(*) from public.families), 0::bigint, 'a user in no family sees zero families');
SELECT is((select count(*) from public.children), 0::bigint, 'a user in no family sees zero children');
SELECT is((select count(*) from public.chores), 0::bigint, 'a user in no family sees zero chores');
SELECT is((select count(*) from public.chore_occurrences), 0::bigint, 'a user in no family sees zero occurrences');
SELECT is((select count(*) from public.weekly_allowances), 0::bigint, 'a user in no family sees zero weekly allowances');
SELECT is((select count(*) from public.family_memberships), 0::bigint, 'a user in no family sees zero memberships');

reset role;

-- Act as a fully unauthenticated request (no JWT at all) ----------------------
set local role anon;
reset request.jwt.claims;

SELECT is((select count(*) from public.families), 0::bigint, 'an unauthenticated request sees zero families');
SELECT is((select count(*) from public.chores), 0::bigint, 'an unauthenticated request sees zero chores');
SELECT is((select count(*) from public.chore_occurrences), 0::bigint, 'an unauthenticated request sees zero occurrences');

reset role;

SELECT * FROM finish();
ROLLBACK;
