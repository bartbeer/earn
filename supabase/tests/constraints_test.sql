-- Proves the database-level constraints actually reject bad data, not just
-- that the SQL "looks correct" (master spec section 57). Runs as the
-- connecting superuser so fixture setup bypasses RLS; that's fine here since
-- this file is about constraints, not authorization (see
-- family_isolation_test.sql / permissions_test.sql for RLS).
BEGIN;
SELECT no_plan();

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id) values ('a0000000-0000-0000-0000-000000000001');
insert into public.families (id, name, created_by)
  values ('a0000000-0000-0000-0000-000000000002', 'Test Family', 'a0000000-0000-0000-0000-000000000001');
insert into public.children (id, family_id, name)
  values ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Test Child');

-- families ------------------------------------------------------------------
SELECT throws_ok(
  $$ insert into public.families (name, created_by)
     values ('', 'a0000000-0000-0000-0000-000000000001') $$,
  '23514',
  NULL,
  'families.name rejects an empty string'
);

-- family_memberships ---------------------------------------------------------
SELECT throws_ok(
  $$ insert into public.family_memberships (family_id, user_id, role)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'grandparent') $$,
  '23514',
  NULL,
  'family_memberships rejects a role outside parent/child'
);

SELECT throws_ok(
  $$ insert into public.family_memberships (family_id, user_id, role, child_id)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'child', null) $$,
  '23514',
  NULL,
  'a child-role membership must reference a child_id'
);

SELECT throws_ok(
  $$ insert into public.family_memberships (family_id, user_id, role, child_id)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'parent', 'a0000000-0000-0000-0000-000000000003') $$,
  '23514',
  NULL,
  'a parent-role membership must not reference a child_id'
);

insert into public.family_memberships (family_id, user_id, role)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'parent');
SELECT throws_ok(
  $$ insert into public.family_memberships (family_id, user_id, role)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'parent') $$,
  '23505',
  NULL,
  'a user cannot have two memberships in the same family'
);

-- chores ----------------------------------------------------------------------
SELECT throws_ok(
  $$ insert into public.chores (family_id, child_id, name, amount_cents, recurrence_type)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Bad chore', -1, 'daily') $$,
  '23514',
  NULL,
  'chores.amount_cents rejects a negative value'
);

SELECT throws_ok(
  $$ insert into public.chores (family_id, child_id, name, amount_cents, recurrence_type)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Bad chore', 999999, 'daily') $$,
  '23514',
  NULL,
  'chores.amount_cents rejects an unreasonably large value'
);

SELECT throws_ok(
  $$ insert into public.chores (family_id, child_id, name, amount_cents, recurrence_type)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Bad chore', 100, 'yearly') $$,
  '23514',
  NULL,
  'chores.recurrence_type rejects a value outside once_weekly/selected_days/daily'
);

SELECT throws_ok(
  $$ insert into public.chores (family_id, child_id, name, amount_cents, recurrence_type)
     values ('00000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000003', 'Orphan chore', 50, 'daily') $$,
  '23503',
  NULL,
  'a chore cannot reference a nonexistent family'
);

-- chore_occurrences -------------------------------------------------------------
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type)
  values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Daily chore', 50, 'daily');
insert into public.chore_occurrences (family_id, chore_id, child_id, scheduled_date, chore_name_snapshot, amount_cents_snapshot)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', '2026-09-21', 'Daily chore', 50);
SELECT throws_ok(
  $$ insert into public.chore_occurrences (family_id, chore_id, child_id, scheduled_date, chore_name_snapshot, amount_cents_snapshot)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', '2026-09-21', 'Daily chore', 50) $$,
  '23505',
  NULL,
  'a chore cannot have two occurrences for the same child on the same date'
);

-- weekly_allowances ---------------------------------------------------------------
insert into public.weekly_allowances (family_id, child_id, week_start, week_end)
  values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '2026-09-14', '2026-09-20');
SELECT throws_ok(
  $$ insert into public.weekly_allowances (family_id, child_id, week_start, week_end)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '2026-09-14', '2026-09-20') $$,
  '23505',
  NULL,
  'a child cannot have two weekly_allowances rows for the same week_start'
);

SELECT throws_ok(
  $$ insert into public.weekly_allowances (family_id, child_id, week_start, week_end, maximum_cents, earned_cents)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '2026-08-31', '2026-09-06', 100, 200) $$,
  '23514',
  NULL,
  'earned_cents cannot exceed maximum_cents'
);

SELECT throws_ok(
  $$ insert into public.weekly_allowances (family_id, child_id, week_start, week_end, payment_status)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '2026-08-17', '2026-08-23', 'paid') $$,
  '23514',
  NULL,
  'marking a week paid without paid_amount_cents/paid_at is rejected'
);

SELECT * FROM finish();
ROLLBACK;
