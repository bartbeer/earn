-- Reported as "I cannot remove a child" — the children table already had
-- an `active` flag (fetchChildren() already filters on it, same pattern as
-- chores), but nothing ever set it. This is the missing half of an
-- already-designed feature, not new scope.
--
-- Deactivating a child must cascade to their chores — otherwise recurrence
-- generation (which only checks chores.active, not the child's) would keep
-- creating new occurrences for a "removed" child forever. That cascade
-- then flows through the existing chore-deactivation trigger from before,
-- which cleans up pending occurrences while preserving completed ones.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('85000000-0000-0000-0000-000000000001'), -- parent
  ('85000000-0000-0000-0000-000000000005'), -- the child's own account
  ('85000000-0000-0000-0000-000000000006'); -- an unrelated parent, different family

insert into public.families (id, name, created_by) values
  ('85000000-0000-0000-0000-000000000002', 'Test Family', '85000000-0000-0000-0000-000000000001'),
  ('85000000-0000-0000-0000-000000000008', 'Other Family', '85000000-0000-0000-0000-000000000006');

insert into public.children (id, family_id, name)
  values ('85000000-0000-0000-0000-000000000003', '85000000-0000-0000-0000-000000000002', 'Test Child');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('85000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000001', 'parent', null),
  ('85000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000005', 'child', '85000000-0000-0000-0000-000000000003'),
  ('85000000-0000-0000-0000-000000000008', '85000000-0000-0000-0000-000000000006', 'parent', null);

insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('85000000-0000-0000-0000-000000000010', '85000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000003', 'Clear table', 50, 'daily', '2026-01-01 00:00:00+00');

-- Fixed "as of" instant, same convention as earlier tests: 2026-09-16 is a
-- Wednesday; the Monday-start week is Sep 14 - Sep 20.
select public._generate_week_occurrences('85000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');
update public.chore_occurrences set status = 'completed', completed_at = now()
  where chore_id = '85000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14';
select public._generate_week_occurrences('85000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '85000000-0000-0000-0000-000000000010'),
  7::bigint,
  'sanity check: 7 occurrences exist before deactivation'
);

-- ==== A child cannot deactivate themselves ===================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "85000000-0000-0000-0000-000000000005", "role": "authenticated"}';
update public.children set active = false where id = '85000000-0000-0000-0000-000000000003';
reset role;

SELECT is(
  (select active from public.children where id = '85000000-0000-0000-0000-000000000003'),
  true,
  'a child cannot deactivate themselves — the attempt had no effect'
);

-- ==== A parent from a different family cannot deactivate this child =========
set local role authenticated;
set local request.jwt.claims to '{"sub": "85000000-0000-0000-0000-000000000006", "role": "authenticated"}';
update public.children set active = false where id = '85000000-0000-0000-0000-000000000003';
reset role;

SELECT is(
  (select active from public.children where id = '85000000-0000-0000-0000-000000000003'),
  true,
  'a different family''s parent cannot deactivate this child either'
);

-- ==== The actual parent can deactivate the child, and it cascades ===========
set local role authenticated;
set local request.jwt.claims to '{"sub": "85000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ update public.children set active = false where id = '85000000-0000-0000-0000-000000000003' $$,
  'the family''s own parent can deactivate the child'
);
reset role;

SELECT is(
  (select active from public.children where id = '85000000-0000-0000-0000-000000000003'),
  false,
  'the child is marked inactive, not deleted'
);
SELECT is(
  (select active from public.chores where id = '85000000-0000-0000-0000-000000000010'),
  false,
  'deactivating the child cascades to deactivate their chores'
);
SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '85000000-0000-0000-0000-000000000010'),
  1::bigint,
  'the chore-deactivation cascade cleaned up pending occurrences, same as a direct chore deactivation would'
);
SELECT is(
  (select status from public.chore_occurrences where chore_id = '85000000-0000-0000-0000-000000000010'),
  'completed',
  'the one remaining occurrence is the completed one — history survives the cascade'
);
SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '85000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'the weekly maximum shrinks to match what survived the cascade'
);
SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '85000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'earned money is never clawed back by the cascade'
);

SELECT * FROM finish();
ROLLBACK;
